import { Octokit } from '@octokit/rest';
import { configService, config } from '../middleware/provider-config';

let connectionSettings: any;

export interface GitHubConfig {
  isReplit: boolean;
  isPAT: boolean;
  isConfigured: boolean;
  authMethod: 'replit_connector' | 'personal_access_token' | 'none';
}

function getGitHubConfig(): GitHubConfig {
  const hasReplitEnv = Boolean(process.env.REPLIT_CONNECTORS_HOSTNAME && 
    (process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL));
  // SECURITY: GitHub token now managed by centralized configuration service
  const hasPAT = Boolean(config.GITHUB_TOKEN);
  
  return {
    isReplit: hasReplitEnv,
    isPAT: hasPAT,
    isConfigured: hasReplitEnv || hasPAT,
    authMethod: hasReplitEnv ? 'replit_connector' : 
                hasPAT ? 'personal_access_token' : 'none'
  };
}

async function getAccessToken() {
  const githubConfig = getGitHubConfig();
  
  // Try Personal Access Token first (works in all environments)
  // SECURITY: GitHub token now comes from centralized configuration service
  if (config.GITHUB_TOKEN) {
    console.log('[GitHub] Using Personal Access Token authentication');
    return config.GITHUB_TOKEN;
  }
  
  // Fall back to Replit connector (only works in Replit environment)
  if (githubConfig.isReplit) {
    console.log('[GitHub] Using Replit connector authentication');
    
    if (connectionSettings && connectionSettings.settings.expires_at && 
        new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
      return connectionSettings.settings.access_token;
    }
    
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const xReplitToken = process.env.REPL_IDENTITY 
      ? 'repl ' + process.env.REPL_IDENTITY 
      : process.env.WEB_REPL_RENEWAL 
      ? 'depl ' + process.env.WEB_REPL_RENEWAL 
      : null;

    if (!xReplitToken) {
      throw new Error('Replit authentication tokens not available');
    }

    connectionSettings = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    ).then(res => res.json()).then(data => data.items?.[0]);

    const accessToken = connectionSettings?.settings?.access_token || 
                       connectionSettings.settings?.oauth?.credentials?.access_token;

    if (!connectionSettings || !accessToken) {
      throw new Error('GitHub Replit connector not properly configured');
    }
    return accessToken;
  }
  
  // No authentication method available
  throw new Error('GitHub integration not configured. Please set GITHUB_TOKEN environment variable or configure Replit GitHub connector.');
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

export class GitHubIntegrationService {
  private async getClient() {
    return getUncachableGitHubClient();
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string) {
    try {
      const octokit = await this.getClient();
      const { data } = await octokit.rest.repos.get({
        owner,
        repo
      });
      return {
        success: true,
        data: {
          id: data.id,
          name: data.name,
          fullName: data.full_name,
          description: data.description,
          private: data.private,
          htmlUrl: data.html_url,
          cloneUrl: data.clone_url,
          language: data.language,
          defaultBranch: data.default_branch,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          stargazersCount: data.stargazers_count,
          forksCount: data.forks_count
        }
      };
    } catch (error) {
      console.error('[GitHub] Error getting repository:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get repository'
      };
    }
  }

  /**
   * List repositories for the authenticated user
   */
  async listRepositories(options: {
    type?: 'all' | 'owner' | 'public' | 'private' | 'member';
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
  } = {}) {
    try {
      const octokit = await this.getClient();
      const { data } = await octokit.rest.repos.listForAuthenticatedUser({
        type: options.type || 'all',
        sort: options.sort || 'updated',
        direction: options.direction || 'desc',
        per_page: options.per_page || 30,
        page: options.page || 1
      });
      
      return {
        success: true,
        data: data.map(repo => ({
          id: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description,
          private: repo.private,
          htmlUrl: repo.html_url,
          cloneUrl: repo.clone_url,
          language: repo.language,
          defaultBranch: repo.default_branch,
          updatedAt: repo.updated_at,
          stargazersCount: repo.stargazers_count,
          forksCount: repo.forks_count
        }))
      };
    } catch (error) {
      console.error('[GitHub] Error listing repositories:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list repositories'
      };
    }
  }

  /**
   * Get workflow runs for a repository
   */
  async getWorkflowRuns(owner: string, repo: string, options: {
    branch?: string;
    event?: string;
    status?: 'completed' | 'action_required' | 'cancelled' | 'failure' | 'neutral' | 'skipped' | 'stale' | 'success' | 'timed_out' | 'in_progress' | 'queued' | 'requested' | 'waiting' | 'pending';
    per_page?: number;
    page?: number;
  } = {}) {
    try {
      const octokit = await this.getClient();
      const { data } = await octokit.rest.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        branch: options.branch,
        event: options.event,
        status: options.status,
        per_page: options.per_page || 30,
        page: options.page || 1
      });
      
      return {
        success: true,
        data: {
          total_count: data.total_count,
          workflow_runs: data.workflow_runs.map(run => ({
            id: run.id,
            name: run.name,
            head_branch: run.head_branch,
            head_sha: run.head_sha,
            status: run.status,
            conclusion: run.conclusion,
            workflow_id: run.workflow_id,
            url: run.url,
            html_url: run.html_url,
            created_at: run.created_at,
            updated_at: run.updated_at,
            event: run.event,
            display_title: run.display_title
          }))
        }
      };
    } catch (error) {
      console.error('[GitHub] Error getting workflow runs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get workflow runs'
      };
    }
  }

  /**
   * Trigger a repository dispatch event for GitHub Actions
   */
  async triggerWorkflow(owner: string, repo: string, eventType: string, clientPayload: any = {}) {
    try {
      const octokit = await this.getClient();
      await octokit.rest.repos.createDispatchEvent({
        owner,
        repo,
        event_type: eventType,
        client_payload: clientPayload
      });
      
      return {
        success: true,
        message: `Workflow triggered successfully with event type: ${eventType}`
      };
    } catch (error) {
      console.error('[GitHub] Error triggering workflow:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to trigger workflow'
      };
    }
  }

  /**
   * Create or update a file in a repository
   */
  async createOrUpdateFile(owner: string, repo: string, path: string, content: string, message: string, options: {
    branch?: string;
    sha?: string; // Required for updates
  } = {}) {
    try {
      const octokit = await this.getClient();
      const encodedContent = Buffer.from(content).toString('base64');
      
      const { data } = await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: encodedContent,
        branch: options.branch,
        sha: options.sha
      });
      
      return {
        success: true,
        data: {
          content: {
            name: data.content?.name,
            path: data.content?.path,
            sha: data.content?.sha,
            size: data.content?.size,
            url: data.content?.url,
            html_url: data.content?.html_url
          },
          commit: {
            sha: data.commit.sha,
            url: data.commit.url,
            html_url: data.commit.html_url,
            message: data.commit.message
          }
        }
      };
    } catch (error) {
      console.error('[GitHub] Error creating/updating file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create/update file'
      };
    }
  }

  /**
   * Get file content from repository
   */
  async getFileContent(owner: string, repo: string, path: string, ref?: string) {
    try {
      const octokit = await this.getClient();
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref
      });
      
      if (Array.isArray(data) || data.type !== 'file') {
        return {
          success: false,
          error: 'Path does not point to a file'
        };
      }
      
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      
      return {
        success: true,
        data: {
          name: data.name,
          path: data.path,
          sha: data.sha,
          size: data.size,
          content,
          encoding: data.encoding,
          url: data.url,
          html_url: data.html_url
        }
      };
    } catch (error) {
      console.error('[GitHub] Error getting file content:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get file content'
      };
    }
  }

  /**
   * Get authenticated user information
   */
  async getAuthenticatedUser() {
    try {
      const octokit = await this.getClient();
      const { data } = await octokit.rest.users.getAuthenticated();
      
      return {
        success: true,
        data: {
          id: data.id,
          login: data.login,
          name: data.name,
          email: data.email,
          avatar_url: data.avatar_url,
          html_url: data.html_url,
          type: data.type,
          site_admin: data.site_admin,
          company: data.company,
          location: data.location,
          bio: data.bio,
          public_repos: data.public_repos,
          public_gists: data.public_gists,
          followers: data.followers,
          following: data.following,
          created_at: data.created_at,
          updated_at: data.updated_at
        }
      };
    } catch (error) {
      console.error('[GitHub] Error getting authenticated user:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get authenticated user'
      };
    }
  }

  /**
   * Get GitHub configuration status
   */
  getConfigurationStatus() {
    return getGitHubConfig();
  }

  /**
   * Health check for GitHub integration with detailed configuration status
   */
  async healthCheck() {
    const config = this.getConfigurationStatus();
    
    if (!config.isConfigured) {
      return {
        healthy: false,
        status: 'not_configured',
        config: {
          authMethod: config.authMethod,
          hasReplitConnector: config.isReplit,
          hasPersonalAccessToken: config.isPAT,
          isConfigured: config.isConfigured
        },
        error: 'GitHub integration not configured',
        message: 'GitHub integration requires either GITHUB_TOKEN environment variable or Replit GitHub connector',
        suggestions: [
          'Set GITHUB_TOKEN environment variable with a GitHub Personal Access Token',
          'Or configure GitHub connector in Replit (development environment only)'
        ]
      };
    }

    try {
      const userInfo = await this.getAuthenticatedUser();
      if (userInfo.success) {
        return {
          healthy: true,
          status: 'connected',
          config: {
            authMethod: config.authMethod,
            hasReplitConnector: config.isReplit,
            hasPersonalAccessToken: config.isPAT,
            isConfigured: config.isConfigured
          },
          user: userInfo.data?.login,
          permissions: [
            'read:user',
            'repo',
            'read:org'
          ],
          message: `GitHub integration is healthy (${config.authMethod})`
        };
      } else {
        return {
          healthy: false,
          status: 'authentication_failed',
          config: {
            authMethod: config.authMethod,
            hasReplitConnector: config.isReplit,
            hasPersonalAccessToken: config.isPAT,
            isConfigured: config.isConfigured
          },
          error: userInfo.error,
          message: 'GitHub authentication failed - check token validity'
        };
      }
    } catch (error) {
      return {
        healthy: false,
        status: 'connection_failed',
        config: {
          authMethod: config.authMethod,
          hasReplitConnector: config.isReplit,
          hasPersonalAccessToken: config.isPAT,
          isConfigured: config.isConfigured
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'GitHub connection failed'
      };
    }
  }
}

export const gitHubIntegrationService = new GitHubIntegrationService();