import { getUncachableGitHubClient } from './server/integrations/github-client.js';

async function createGitHubRepository() {
  try {
    const octokit = await getUncachableGitHubClient();
    
    // Get authenticated user info
    const { data: user } = await octokit.rest.users.getAuthenticated();
    console.log(`Authenticated as: ${user.login}`);
    
    // Create the repository
    const repoData = {
      name: 'dha-digital-services-platform',
      description: 'Ultra-secure DHA Digital Services Platform for South Africa with enhanced Queen Raeesa identity protection, featuring 5 Ultra AIs, comprehensive self-healing architecture, authentic API integrations, and nanosecond-level monitoring.',
      private: false, // Set to true if you want a private repo
      auto_init: false, // Don't create README since we have files
      has_issues: true,
      has_projects: true,
      has_wiki: true
    };
    
    const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser(repoData);
    
    console.log('✅ Repository created successfully!');
    console.log(`📁 Repository Name: ${repo.name}`);
    console.log(`🔗 Repository URL: ${repo.html_url}`);
    console.log(`📋 Clone URL: ${repo.clone_url}`);
    console.log(`🔗 SSH URL: ${repo.ssh_url}`);
    
    return repo;
  } catch (error) {
    if (error.status === 422 && error.response?.data?.errors?.[0]?.message?.includes('already exists')) {
      console.log('⚠️ Repository already exists. Here are the details:');
      
      // Get existing repository
      const { data: user } = await getUncachableGitHubClient().then(client => client.rest.users.getAuthenticated());
      const { data: repo } = await getUncachableGitHubClient().then(client => 
        client.rest.repos.get({
          owner: user.login,
          repo: 'dha-digital-services-platform'
        })
      );
      
      console.log(`📁 Repository Name: ${repo.name}`);
      console.log(`🔗 Repository URL: ${repo.html_url}`);
      console.log(`📋 Clone URL: ${repo.clone_url}`);
      console.log(`🔗 SSH URL: ${repo.ssh_url}`);
      
      return repo;
    } else {
      console.error('❌ Error creating repository:', error.message);
      throw error;
    }
  }
}

createGitHubRepository().catch(console.error);