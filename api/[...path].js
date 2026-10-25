import { handleApiRequest } from '../backend/index.js'

export default async function api(request, response) {
  await handleApiRequest(request, response)
}
