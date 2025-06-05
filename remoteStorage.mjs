export class RemoteStorage {
  constructor(namespace, token) {
    this.namespace = namespace;
    this.endpoint = 'https://remote-storage.dan-5d7.workers.dev/v1';
    this.requestHeaders = {
      'Authorization': token,
      'Content-Type': 'application/json'
    };
  }

  // Returns an array of all keys
  async keys() {
    let result = [], cursor = null;

    while (true) {
      const { keys, cursor: nextCursor, list_complete } = await this.keysPaged({ cursor });
      result.push(...keys);
      if (list_complete) break;
      cursor = nextCursor;
    }
    return result;
  }

  // Returns { keys: [...], cursor, list_complete }
  async keysPaged({ limit = 1000, cursor: inputCursor = null } = {}) {
    const { items, cursor, list_complete } = await this.list({ limit, cursor: inputCursor });
    const keys = items.map(item => item.name);
    return { keys, cursor, list_complete };
  }

  // Returns { key: { value, metadata }, ... } 
  // for all keys in the namespace matching any of the prefixes
  async getNamespace(...prefixes) {
    const result = {};
    let inputCursor = null;

    while (true) {
      const { items, cursor, list_complete } = await this.list({ cursor: inputCursor });

      const matchingItems = prefixes.length ?
        items.filter(item => prefixes.some(prefix => item.name.startsWith(prefix))) : items;
      
      const promises = matchingItems.map(async ({name, metadata}) => {
          const value = await this.getItem(name);
          result[name] = { value, metadata };
      });
      await Promise.all(promises);

      if (list_complete) break;
      inputCursor = cursor;
    }
    return result;
  }

  // Returns { items: [{ name, metadata : { creationTime, updateTime } }], cursor, list_complete }
  async list({ limit = 1000, cursor = null } = {}) {
    return this.fetch('GET', '/list', null, { limit, cursor });
  }

  // Returns null
  async setItem(key, value) {
    return this.fetch('POST', '/set', { key, value });
  }

  // Returns value
  async getItem(key) {
    return this.fetch('GET', '/get', null, { key });
  }

  // Returns { value, metadata }
  async getItemWithMetadata(key) {
    return this.fetch('GET', '/getWithMetadata', null, { key });
  }

  // Returns null
  async removeItem(key) {
    return this.fetch('DELETE', '/delete', null, { key });
  }

  // Returns null
  async clear() {
    const keys = await this.keys();
    const promises = keys.map(key => this.removeItem(key));
    await Promise.all(promises);
    return null;
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
      if (!response.ok) throw { error: json };
      return json;
    } catch (error) {
      console.log(`${method} ${url} → ERROR: ${error.message}`);
      throw error;
    }
  }
}