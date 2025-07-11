import * as vscode from 'vscode';
import axios from 'axios';

interface NetlifySite {
    id: string;
    name: string;
    url: string;
    admin_url: string;
    screenshot_url?: string;
    created_at: string;
    updated_at: string;
    published_deploy?: {
        id: string;
        state: string;
        branch: string;
        created_at: string;
    };
}

export class ConfigurationPanel {
    private panel: vscode.WebviewPanel | undefined;
    private disposables: vscode.Disposable[] = [];

    constructor(private context: vscode.ExtensionContext) {}

    public show() {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'netlifyConfig',
            'Netlify Configuration',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getWebviewContent();
        this.setupWebviewMessageListener();

        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.disposables.forEach(d => d.dispose());
            this.disposables = [];
        }, null, this.disposables);

        // Load current configuration
        this.loadCurrentConfig();
    }

    private async loadCurrentConfig() {
        const config = vscode.workspace.getConfiguration('netlify-status');
        const currentConfig = {
            apiToken: config.get<string>('apiToken') || '',
            siteId: config.get<string>('siteId') || '',
            siteName: config.get<string>('siteName') || '',
            refreshInterval: config.get<number>('refreshInterval') || 10,
            showSiteName: config.get<boolean>('showSiteName') ?? true,
            showDeployTime: config.get<boolean>('showDeployTime') ?? true,
            showProgressBar: config.get<boolean>('showProgressBar') ?? true
        };

        this.panel?.webview.postMessage({
            type: 'loadConfig',
            config: currentConfig
        });

        // If site is already configured, load its info automatically
        if (currentConfig.apiToken && currentConfig.siteId) {
            setTimeout(() => {
                this.loadCurrentSiteInfo(currentConfig.apiToken, currentConfig.siteId);
            }, 500);
        }
    }

    private setupWebviewMessageListener() {
        if (!this.panel) {return;}
        
        const messageListener = this.panel.webview.onDidReceiveMessage(
            async (message) => {
                console.log('Received message:', message.type, message);
                switch (message.type) {
                    case 'testToken':
                        await this.testApiToken(message.token);
                        break;
                    case 'loadSites':
                        await this.loadSites(message.token);
                        break;
                    case 'saveConfig':
                        await this.saveConfiguration(message.config);
                        break;
                    case 'openNetlifyDashboard':
                        await vscode.env.openExternal(vscode.Uri.parse('https://app.netlify.com/user/applications'));
                        break;
                }
            },
            undefined,
            this.disposables
        );
        
        this.disposables.push(messageListener);
    }

    private async testApiToken(token: string) {
        try {
            const response = await axios.get('https://api.netlify.com/api/v1/user', {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                timeout: 10000
            });

            this.panel?.webview.postMessage({
                type: 'tokenTestResult',
                success: true,
                user: response.data
            });
        } catch (error) {
            this.panel?.webview.postMessage({
                type: 'tokenTestResult',
                success: false,
                error: axios.isAxiosError(error) ? error.response?.data?.message || 'Invalid token' : 'Connection error'
            });
        }
    }

    private async loadSites(token: string) {
        try {
            const response = await axios.get<NetlifySite[]>('https://api.netlify.com/api/v1/sites', {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                timeout: 15000
            });

            // Sort sites by most recently updated
            const sites = response.data.sort((a, b) => 
                new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            );

            this.panel?.webview.postMessage({
                type: 'sitesLoaded',
                sites: sites
            });
        } catch (error) {
            this.panel?.webview.postMessage({
                type: 'sitesLoadError',
                error: axios.isAxiosError(error) ? error.response?.data?.message || 'Failed to load sites' : 'Connection error'
            });
        }
    }

    private async saveConfiguration(config: any) {
        try {
            console.log('Saving configuration:', config);
            const wsConfig = vscode.workspace.getConfiguration('netlify-status');
            await wsConfig.update('apiToken', config.apiToken, vscode.ConfigurationTarget.Global);
            await wsConfig.update('siteId', config.siteId, vscode.ConfigurationTarget.Global);
            await wsConfig.update('siteName', config.siteName, vscode.ConfigurationTarget.Global);
            await wsConfig.update('refreshInterval', config.refreshInterval, vscode.ConfigurationTarget.Global);
            await wsConfig.update('showSiteName', config.showSiteName, vscode.ConfigurationTarget.Global);
            await wsConfig.update('showDeployTime', config.showDeployTime, vscode.ConfigurationTarget.Global);
            await wsConfig.update('showProgressBar', config.showProgressBar, vscode.ConfigurationTarget.Global);

            this.panel?.webview.postMessage({
                type: 'configSaved',
                success: true
            });

            vscode.window.showInformationMessage('Netlify configuration saved successfully!');
            
            console.log('Configuration saved successfully');
            
            // Force a refresh by firing the configuration change event
            setTimeout(() => {
                vscode.commands.executeCommand('netlify-status.refresh');
            }, 100);
            
            // Close the panel after a brief delay
            setTimeout(() => {
                this.panel?.dispose();
            }, 2000);

        } catch (error) {
            console.error('Error saving configuration:', error);
            this.panel?.webview.postMessage({
                type: 'configSaved',
                success: false,
                error: 'Failed to save configuration'
            });
        }
    }

    private async loadCurrentSiteInfo(token: string, siteId: string) {
        try {
            const response = await axios.get<NetlifySite>(`https://api.netlify.com/api/v1/sites/${siteId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                timeout: 10000
            });

            const site = response.data;
            
            this.panel?.webview.postMessage({
                type: 'currentSiteLoaded',
                site: site
            });
        } catch (error) {
            console.error('Error loading current site info:', error);
            // If we can't load the current site, still allow configuration changes
            this.panel?.webview.postMessage({
                type: 'currentSiteLoadError',
                error: 'Could not load current site info, but you can still modify settings'
            });
        }
    }

    private getWebviewContent(): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Netlify Configuration</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
        }
        
        h1 {
            color: var(--vscode-titleBar-activeForeground);
            margin-bottom: 20px;
        }
        
        .step {
            margin-bottom: 30px;
            padding: 20px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 8px;
        }
        
        .step h2 {
            margin-top: 0;
            color: var(--vscode-textLink-foreground);
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
        }
        
        input[type="text"], input[type="password"], input[type="number"], select {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-size: 14px;
        }
        
        input[type="checkbox"] {
            margin-right: 8px;
        }
        
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 10px;
        }
        
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .success {
            color: var(--vscode-testing-iconPassed);
        }
        
        .error {
            color: var(--vscode-errorForeground);
        }
        
        .info {
            color: var(--vscode-textLink-foreground);
        }
        
        .site-list {
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            margin-top: 10px;
        }
        
        .site-item {
            padding: 12px;
            border-bottom: 1px solid var(--vscode-input-border);
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .site-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .site-item.selected {
            background-color: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }
        
        .site-name {
            font-weight: 600;
            margin-bottom: 4px;
        }
        
        .site-url {
            font-size: 12px;
            opacity: 0.8;
            margin-bottom: 4px;
        }
        
        .site-status {
            font-size: 12px;
            opacity: 0.7;
        }
        
        .hidden {
            display: none;
        }
        
        .loading {
            text-align: center;
            padding: 20px;
            color: var(--vscode-textLink-foreground);
        }
        
        .help-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }
        
        .link {
            color: var(--vscode-textLink-foreground);
            text-decoration: underline;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Netlify Status Configuration</h1>
        
        <div class="step">
            <h2>Step 1: API Token</h2>
            <div class="form-group">
                <label for="apiToken">Netlify Personal Access Token</label>
                <input type="password" id="apiToken" placeholder="Enter your token here...">
                <div class="help-text">
                    Don't have a token? <span class="link" onclick="openNetlifyDashboard()">Get one from Netlify</span>
                </div>
            </div>
            <button onclick="testToken()">Test Token</button>
            <div id="tokenStatus"></div>
        </div>
        
        <div class="step hidden" id="step2">
            <h2>Step 2: Select Your Site</h2>
            <button onclick="loadSites()">Load My Sites</button>
            <div id="sitesContainer"></div>
        </div>
        
        <div class="step hidden" id="step3">
            <h2>Step 3: Configuration Options</h2>
            <div class="form-group">
                <label for="siteName">Display Name (optional)</label>
                <input type="text" id="siteName" placeholder="Custom name for your site">
                <div class="help-text">Leave blank to use the site's default name</div>
            </div>
            
            <div class="form-group">
                <label for="refreshInterval">Refresh Interval (seconds)</label>
                <input type="number" id="refreshInterval" value="10" min="5" max="300">
                <div class="help-text">How often to check for updates (5-300 seconds, lower = more responsive)</div>
            </div>
            
            <div class="form-group">
                <label>
                    <input type="checkbox" id="showSiteName" checked>
                    Show site name in status bar
                </label>
            </div>
            
            <div class="form-group">
                <label>
                    <input type="checkbox" id="showDeployTime" checked>
                    Show deployment duration
                </label>
            </div>
            
            <div class="form-group">
                <label>
                    <input type="checkbox" id="showProgressBar" checked>
                    Show progress bar during builds
                </label>
            </div>
            
            <button onclick="saveConfig()">Save Configuration</button>
            <div id="saveStatus"></div>
        </div>
    </div>

    <script>
        let selectedSite = null;
        let currentToken = '';
        let currentSiteId = '';
        let currentSiteName = '';
        
        const vscode = acquireVsCodeApi();
        
        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'loadConfig':
                    loadConfiguration(message.config);
                    break;
                case 'tokenTestResult':
                    handleTokenTestResult(message);
                    break;
                case 'sitesLoaded':
                    displaySites(message.sites);
                    break;
                case 'sitesLoadError':
                    handleSitesLoadError(message.error);
                    break;
                case 'configSaved':
                    handleConfigSaved(message);
                    break;
                case 'currentSiteLoaded':
                    handleCurrentSiteLoaded(message);
                    break;
                case 'currentSiteLoadError':
                    handleCurrentSiteLoadError(message);
                    break;
            }
        });
        
        function loadConfiguration(config) {
            document.getElementById('apiToken').value = config.apiToken;
            document.getElementById('siteName').value = config.siteName;
            document.getElementById('refreshInterval').value = config.refreshInterval;
            document.getElementById('showSiteName').checked = config.showSiteName;
            document.getElementById('showDeployTime').checked = config.showDeployTime;
            document.getElementById('showProgressBar').checked = config.showProgressBar;
            
            if (config.apiToken) {
                currentToken = config.apiToken;
                document.getElementById('step2').classList.remove('hidden');
                if (config.siteId) {
                    currentSiteId = config.siteId;
                    currentSiteName = config.siteName || 'Unknown Site';
                    document.getElementById('step3').classList.remove('hidden');
                }
            }
        }
        
        function testToken() {
            const token = document.getElementById('apiToken').value;
            if (!token) {
                document.getElementById('tokenStatus').innerHTML = '<span class="error">Please enter a token</span>';
                return;
            }
            
            currentToken = token;
            document.getElementById('tokenStatus').innerHTML = '<span class="info">Testing token...</span>';
            
            vscode.postMessage({
                type: 'testToken',
                token: token
            });
        }
        
        function handleTokenTestResult(message) {
            const statusDiv = document.getElementById('tokenStatus');
            if (message.success) {
                statusDiv.innerHTML = '<span class="success">✓ Token is valid! Welcome, ' + message.user.full_name + '</span>';
                document.getElementById('step2').classList.remove('hidden');
            } else {
                statusDiv.innerHTML = '<span class="error">✗ ' + message.error + '</span>';
            }
        }
        
        function loadSites() {
            if (!currentToken) {
                alert('Please test your token first');
                return;
            }
            
            document.getElementById('sitesContainer').innerHTML = '<div class="loading">Loading your sites...</div>';
            
            vscode.postMessage({
                type: 'loadSites',
                token: currentToken
            });
        }
        
        function displaySites(sites) {
            const container = document.getElementById('sitesContainer');
            
            if (sites.length === 0) {
                container.innerHTML = '<div class="info">No sites found. Create a site in Netlify first.</div>';
                return;
            }
            
            let html = '<div class="site-list">';
            sites.forEach(site => {
                const deployStatus = site.published_deploy ? 
                    site.published_deploy.state : 'No deployments';
                const lastUpdate = new Date(site.updated_at).toLocaleDateString();
                
                html += \`
                    <div class="site-item" onclick="selectSite('\${site.id}', '\${site.name}')">
                        <div class="site-name">\${site.name}</div>
                        <div class="site-url">\${site.url}</div>
                        <div class="site-status">Status: \${deployStatus} • Updated: \${lastUpdate}</div>
                    </div>
                \`;
            });
            html += '</div>';
            
            container.innerHTML = html;
        }
        
        function selectSite(siteId, siteName) {
            selectedSite = { id: siteId, name: siteName };
            
            // Update UI to show selection
            document.querySelectorAll('.site-item').forEach(item => {
                item.classList.remove('selected');
            });
            event.target.classList.add('selected');
            
            // Show step 3
            document.getElementById('step3').classList.remove('hidden');
            
            // Auto-fill site name if empty
            const siteNameInput = document.getElementById('siteName');
            if (!siteNameInput.value) {
                siteNameInput.value = siteName;
            }
        }
        
        function handleSitesLoadError(error) {
            document.getElementById('sitesContainer').innerHTML = '<div class="error">Error loading sites: ' + error + '</div>';
        }
        
        function saveConfig() {
            // Get current site ID from either selectedSite or the loaded configuration
            let siteId = selectedSite ? selectedSite.id : currentSiteId;
            
            if (!siteId) {
                alert('Please select a site first');
                return;
            }
            
            const config = {
                apiToken: currentToken,
                siteId: siteId,
                siteName: document.getElementById('siteName').value,
                refreshInterval: parseInt(document.getElementById('refreshInterval').value),
                showSiteName: document.getElementById('showSiteName').checked,
                showDeployTime: document.getElementById('showDeployTime').checked,
                showProgressBar: document.getElementById('showProgressBar').checked
            };
            
            console.log('Sending saveConfig message:', config);
            document.getElementById('saveStatus').innerHTML = '<span class="info">Saving configuration...</span>';
            
            vscode.postMessage({
                type: 'saveConfig',
                config: config
            });
        }
        
        function handleConfigSaved(message) {
            const statusDiv = document.getElementById('saveStatus');
            if (message.success) {
                statusDiv.innerHTML = '<span class="success">✓ Configuration saved successfully!</span>';
            } else {
                statusDiv.innerHTML = '<span class="error">✗ ' + message.error + '</span>';
            }
        }
        
        function openNetlifyDashboard() {
            vscode.postMessage({
                type: 'openNetlifyDashboard'
            });
        }
        
        function handleCurrentSiteLoaded(message) {
            const site = message.site;
            currentSiteId = site.id;
            currentSiteName = site.name;
            
            // Update the sites container to show current site
            document.getElementById('sitesContainer').innerHTML = \`
                <div class="info">
                    <strong>Currently Configured Site:</strong><br>
                    <div style="margin-top: 8px; padding: 12px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 4px;">
                        <div class="site-name">\${site.name}</div>
                        <div class="site-url">\${site.url}</div>
                        <div style="margin-top: 8px;">
                            <button onclick="loadSites()" style="font-size: 12px; padding: 4px 8px;">Change Site</button>
                        </div>
                    </div>
                </div>
            \`;
        }
        
        function handleCurrentSiteLoadError(message) {
            document.getElementById('sitesContainer').innerHTML = \`
                <div class="info">
                    <strong>Current site configured</strong><br>
                    <div style="margin-top: 8px; color: var(--vscode-descriptionForeground);">
                        \${message.error}
                    </div>
                    <div style="margin-top: 8px;">
                        <button onclick="loadSites()">Load Sites</button>
                    </div>
                </div>
            \`;
        }
    </script>
</body>
</html>`;
    }

    public dispose() {
        this.panel?.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}