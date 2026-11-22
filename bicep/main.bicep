targetScope = 'subscription'

@description('Resource prefix for the single Linked Assets application.')
param projectName string = 'linked-assets'
param location string = 'eastus2'
@allowed(['Free', 'Standard'])
param sku string = 'Free'

resource group 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: '${projectName}-rg'
  location: location
}

module site 'modules/staticWebApp.bicep' = {
  name: '${projectName}-static-host'
  scope: group
  params: {
    name: '${projectName}-swa'
    location: location
    sku: sku
  }
}

output hostname string = site.outputs.hostname
output resourceId string = site.outputs.resourceId
