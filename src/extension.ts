import * as vscode from 'vscode';
import axios from 'axios';
import { ConfigurationPanel } from './configPanel';

interface NetlifyDeployment {
    id: string;
    state: string;
    branch: string;
    created_at: string;
    updated_at: string;
    site_id: string;
    deploy_url: string;
    admin_url: string;
    build_id?: string;
    error_message?: string;
}

interface NetlifySite {
    id: string;
    name: string;
    url: string;
    admin_url: string;
    published_deploy?: NetlifyDeployment;
}

class NetlifyStatusProvider {
    private statusBarItem: vscode.StatusBarItem;
    private refreshTimer: NodeJS.Timeout | undefined;
    private isRefreshing = false;
    private configPanel: ConfigurationPanel;
    private deploymentStartTime: Date | null = null;
    private lastDeploymentState: string | null = null;

    constructor(private context: vscode.ExtensionContext) {
        this.configPanel = new ConfigurationPanel(context);
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'netlify-status.openDashboard';
        this.statusBarItem.show();
        
        this.updateStatusBar('⚪ Netlify: Not configured', 'Click to configure Netlify');
        this.startRefreshTimer();
    }

    private async getConfig() {
        const config = vscode.workspace.getConfiguration('netlify-status');
        const configObj = {
            apiToken: config.get<string>('apiToken') || '',
            siteId: config.get<string>('siteId') || '',
            siteName: config.get<string>('siteName') || '',
            refreshInterval: config.get<number>('refreshInterval') || 10,
            showSiteName: config.get<boolean>('showSiteName') ?? true,
            showDeployTime: config.get<boolean>('showDeployTime') ?? true,
            showProgressBar: config.get<boolean>('showProgressBar') ?? true
        };
        console.log('Current config:', configObj);
        return configObj;
    }

    private async fetchSiteStatus(): Promise<void> {
        if (this.isRefreshing) return;
        this.isRefreshing = true;

        try {
            const config = await this.getConfig();
            
            if (!config.apiToken || !config.siteId) {
                this.updateStatusBar('⚪ Netlify: Not configured', 'Click to configure Netlify');
                return;
            }

            console.log('Fetching site status for:', config.siteId);

            // Get the latest deployment (not just published_deploy)
            const deploymentsResponse = await axios.get<NetlifyDeployment[]>(`https://api.netlify.com/api/v1/sites/${config.siteId}/deploys`, {
                headers: {
                    'Authorization': `Bearer ${config.apiToken}`
                },
                timeout: 10000,
                params: {
                    per_page: 1  // Just get the latest deployment
                }
            });

            const deployments = deploymentsResponse.data;
            if (!deployments || deployments.length === 0) {
                this.updateStatusBar('⚪ Netlify: No deployments', 'No deployments found');
                return;
            }

            const deployment = deployments[0];  // Latest deployment
            console.log('Latest deployment state:', deployment.state, 'ID:', deployment.id.substring(0, 8));

            // Also get site info for name/URL
            const siteResponse = await axios.get<NetlifySite>(`https://api.netlify.com/api/v1/sites/${config.siteId}`, {
                headers: {
                    'Authorization': `Bearer ${config.apiToken}`
                },
                timeout: 10000
            });

            const site = siteResponse.data;

            // Track deployment state changes
            if (this.lastDeploymentState !== deployment.state) {
                console.log(`Deployment state changed: ${this.lastDeploymentState} → ${deployment.state}`);
                if (deployment.state === 'building' || deployment.state === 'processing') {
                    this.deploymentStartTime = new Date(deployment.created_at);
                    // Increase refresh frequency during builds
                    this.startRefreshTimer(5); // Check every 5 seconds during builds
                } else if (deployment.state === 'ready') {
                    this.deploymentStartTime = null;
                    // Return to normal refresh frequency
                    this.startRefreshTimer();
                }
                this.lastDeploymentState = deployment.state;
            }

            const displayName = config.showSiteName ? (config.siteName || site.name) : 'Netlify';
            const { statusBarText, tooltip } = this.formatStatusDisplay(deployment, site, displayName, config);

            this.updateStatusBar(statusBarText, tooltip);
            
            // Store the admin URL for opening dashboard
            this.context.workspaceState.update('netlify-admin-url', site.admin_url);

        } catch (error) {
            console.error('Netlify API Error:', error);
            
            let errorMessage = 'Connection error';
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    errorMessage = 'Invalid token';
                } else if (error.response?.status === 404) {
                    errorMessage = 'Site not found';
                } else if (error.code === 'ECONNABORTED') {
                    errorMessage = 'Timeout';
                }
            }
            
            this.updateStatusBar(`⚠️ Netlify: ${errorMessage}`, 'Click to configure or check settings');
        } finally {
            this.isRefreshing = false;
        }
    }

    private updateStatusBar(text: string, tooltip: string) {
        this.statusBarItem.text = text;
        this.statusBarItem.tooltip = tooltip;
    }

    public startRefreshTimer(overrideInterval?: number) {
        this.stopRefreshTimer();
        
        this.getConfig().then(config => {
            const interval = overrideInterval || config.refreshInterval;
            console.log(`Starting refresh timer: ${interval}s interval`);
            this.refreshTimer = setInterval(() => {
                this.fetchSiteStatus();
            }, interval * 1000);
        });
    }

    private stopRefreshTimer() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = undefined;
        }
    }

    private formatStatusDisplay(deployment: NetlifyDeployment, site: NetlifySite, displayName: string, config: any): { statusBarText: string, tooltip: string } {
        const now = new Date();
        const createdAt = new Date(deployment.created_at);
        const updatedAt = new Date(deployment.updated_at);
        
        let statusBarText = '';
        let tooltip = '';
        
        switch (deployment.state) {
            case 'ready':
                const deployTime = Math.floor((updatedAt.getTime() - createdAt.getTime()) / 1000);
                const deployDuration = this.formatDuration(deployTime);
                
                const timeDisplay = config.showDeployTime ? ` (${deployDuration})` : '';
                statusBarText = `✅ ${config.showSiteName ? displayName : 'Netlify'}: deployed${timeDisplay}`;
                
                tooltip = [
                    `Site: ${site.name}`,
                    `Status: Successfully deployed`,
                    `Branch: ${deployment.branch}`,
                    `Deploy time: ${deployDuration}`,
                    `Completed: ${updatedAt.toLocaleString()}`,
                    `Deploy ID: ${deployment.id.substring(0, 8)}`,
                    '',
                    'Click to open Netlify dashboard'
                ].join('\n');
                break;
                
            case 'building':
            case 'processing':
                const buildTime = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
                const buildDuration = this.formatDuration(buildTime);
                
                const icon = deployment.state === 'building' ? '🔨' : '🚀';
                const action = deployment.state === 'building' ? 'building' : 'deploying';
                
                const progressBar = config.showProgressBar ? ` ${this.createProgressBar(buildTime)}` : '';
                const timeDisplay2 = config.showDeployTime ? ` ${buildDuration}` : '';
                statusBarText = `${icon} ${config.showSiteName ? displayName : 'Netlify'}: ${action}${progressBar}${timeDisplay2}`;
                
                tooltip = [
                    `Site: ${site.name}`,
                    `Status: ${deployment.state}`,
                    `Branch: ${deployment.branch}`,
                    `Building for: ${buildDuration}`,
                    `Started: ${createdAt.toLocaleString()}`,
                    `Deploy ID: ${deployment.id.substring(0, 8)}`,
                    '',
                    'Click to open Netlify dashboard'
                ].join('\n');
                break;
                
            case 'error':
            case 'failed':
                const failTime = Math.floor((updatedAt.getTime() - createdAt.getTime()) / 1000);
                const failDuration = this.formatDuration(failTime);
                
                const timeDisplay3 = config.showDeployTime ? ` after ${failDuration}` : '';
                statusBarText = `❌ ${config.showSiteName ? displayName : 'Netlify'}: failed${timeDisplay3}`;
                
                tooltip = [
                    `Site: ${site.name}`,
                    `Status: Build failed`,
                    `Branch: ${deployment.branch}`,
                    `Failed after: ${failDuration}`,
                    `Error: ${deployment.error_message || 'Build error'}`,
                    `Deploy ID: ${deployment.id.substring(0, 8)}`,
                    '',
                    'Click to view error logs'
                ].join('\n');
                break;
                
            default:
                statusBarText = `⚪ ${config.showSiteName ? displayName : 'Netlify'}: ${deployment.state}`;
                
                tooltip = [
                    `Site: ${site.name}`,
                    `Status: ${deployment.state}`,
                    `Branch: ${deployment.branch}`,
                    `Updated: ${updatedAt.toLocaleString()}`,
                    `Deploy ID: ${deployment.id.substring(0, 8)}`,
                    '',
                    'Click to open Netlify dashboard'
                ].join('\n');
        }
        
        return { statusBarText, tooltip };
    }

    private createProgressBar(buildTimeSeconds: number): string {
        // Estimate progress based on typical build times
        // Most builds take 1-5 minutes, so we'll create a progress bar based on that
        const estimatedTotalTime = 180; // 3 minutes typical
        const progress = Math.min(buildTimeSeconds / estimatedTotalTime, 1);
        const totalBars = 10;
        const filledBars = Math.floor(progress * totalBars);
        const emptyBars = totalBars - filledBars;
        
        return `[${`█`.repeat(filledBars)}${`░`.repeat(emptyBars)}]`;
    }

    private formatDuration(seconds: number): string {
        if (seconds < 60) {
            return `${seconds}s`;
        }
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        if (minutes < 60) {
            return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
        }
        
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }

    public async refresh() {
        await this.fetchSiteStatus();
    }

    public async configure() {
        this.configPanel.show();
    }

    public async openDashboard() {
        const adminUrl = this.context.workspaceState.get<string>('netlify-admin-url');
        
        if (adminUrl) {
            await vscode.env.openExternal(vscode.Uri.parse(adminUrl));
        } else {
            await this.configure();
        }
    }

    public async reset() {
        const result = await vscode.window.showWarningMessage(
            'This will clear all Netlify configuration. Are you sure?',
            'Reset',
            'Cancel'
        );

        if (result === 'Reset') {
            const config = vscode.workspace.getConfiguration('netlify-status');
            await config.update('apiToken', undefined, vscode.ConfigurationTarget.Global);
            await config.update('siteId', undefined, vscode.ConfigurationTarget.Global);
            await config.update('siteName', undefined, vscode.ConfigurationTarget.Global);
            await config.update('refreshInterval', undefined, vscode.ConfigurationTarget.Global);
            await config.update('showSiteName', undefined, vscode.ConfigurationTarget.Global);
            await config.update('showDeployTime', undefined, vscode.ConfigurationTarget.Global);
            await config.update('showProgressBar', undefined, vscode.ConfigurationTarget.Global);

            // Clear workspace state
            await this.context.workspaceState.update('netlify-admin-url', undefined);

            vscode.window.showInformationMessage('Netlify configuration reset successfully!');
            
            // Reset status bar
            this.updateStatusBar('⚪ Netlify: Not configured', 'Click to configure Netlify');
        }
    }

    public dispose() {
        this.stopRefreshTimer();
        this.statusBarItem.dispose();
        this.configPanel.dispose();
    }
}

export function activate(context: vscode.ExtensionContext) {
    const provider = new NetlifyStatusProvider(context);

    // Register commands
    const configureCommand = vscode.commands.registerCommand('netlify-status.configure', () => {
        provider.configure();
    });

    const refreshCommand = vscode.commands.registerCommand('netlify-status.refresh', () => {
        provider.refresh();
    });

    const openDashboardCommand = vscode.commands.registerCommand('netlify-status.openDashboard', () => {
        provider.openDashboard();
    });

    const resetCommand = vscode.commands.registerCommand('netlify-status.reset', () => {
        provider.reset();
    });

    // Listen for configuration changes
    const configChangeListener = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('netlify-status')) {
            console.log('Configuration changed, refreshing...');
            provider.refresh();
            provider.startRefreshTimer();
        }
    });

    context.subscriptions.push(
        provider,
        configureCommand,
        refreshCommand,
        openDashboardCommand,
        resetCommand,
        configChangeListener
    );

    // Initial fetch
    provider.refresh();
}

export function deactivate() {}