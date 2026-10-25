import { handleApiRequest } from '../../backend/index.js'

export default async function registerOwner(request, response) {
  await handleApiRequest(request, response)
}
