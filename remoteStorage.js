export class RemoteStorage {
  constructor(namespace, token) {
    this.namespace = namespace;
    this.endpoint = 'https://remote-storage.dan-5d7.workers.dev/v1';
    this.requestHeaders = {
      'Authorization': token,
      'Content-Type': 'application/json'
    };
  }

  async keys() {
    let result = [];
    let cursor = null;

    while (true) {
      const { keys, cursor: nextCursor, list_complete } = await this.keysPaged({ cursor });
      result.push(...keys);
      if (list_complete) break;
      cursor = nextCursor;
    }

    return result;
  }

  async keysPaged({ limit = 1000, cursor = null } = {}) {
    return this.fetch('GET', '/list', null, { limit, cursor });
  }

  async setItem(key, value) {
    return this.fetch('POST', '/set', { key, value });
  }

  async getItem(key) {
    return this.fetch('GET', '/get', null, { key });
  }

  async getItemWithMetadata(key) {
    return this.fetch('GET', '/getWithMetadata', null, { key });
  }

  async removeItem(key) {
    return this.fetch('DELETE', '/delete', null, { key });
  }

  async clear() {
    const keys = await this.keys();
    const promises = keys.map(key => this.removeItem(key));
    return Promise.all(promises).then(() => null);
  }

  async fetch(method, path, data = null, queryParams = {}) {
    // Always include namespace
    queryParams = { ...queryParams, namespace: this.namespace };

    let url = new URL(`${this.endpoint}${path}`);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null) {
        params.append(key, value);
      }
    }
    url.search = params.toString();

    const options = { method, headers: this.requestHeaders };
    if (data) options.body = JSON.stringify(data);

    try {
      const response = await fetch(url, options);
      const json = await response.json();
      return json;
    } catch (error) {
      console.log(`${method} ${url} → ERROR: ${error.message}`);
      throw error;
    }
  }
}