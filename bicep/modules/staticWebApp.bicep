param name string
param location string
param sku string

resource site 'Microsoft.Web/staticSites@2024-04-01' = {
  name: name
  location: location
  sku: { name: sku, tier: sku }
  properties: {
    buildProperties: {
      appLocation: '/'
      apiLocation: ''
      outputLocation: ''
      skipGithubActionWorkflowGeneration: true
    }
  }
}

output hostname string = site.properties.defaultHostname
output resourceId string = site.id
