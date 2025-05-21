
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
    return this.fetch('GET', `/list?namespace=${this.namespace}`);
  }
  
  async setItem(key, value) {
    return this.fetch('POST', `/set?namespace=${this.namespace}`, { key, value });
  }
  
  async getItem(key) {
    return this.fetch('GET', `/get?namespace=${this.namespace}&key=${key}`);
  }
  
  async removeItem(key) {
    return this.fetch('DELETE', `/delete?namespace=${this.namespace}&key=${key}`);
  }

  async clear() {
    const keys = await this.keys();
    const promises = keys.map(key => this.removeItem(key));
    return Promise.all(promises).then(() => null);
  }

  async fetch(method, path, data = null) {
    const options = { method, headers: this.requestHeaders };
    if (data) options.body = JSON.stringify(data);
  
    try {
      const response = await fetch(`${this.endpoint}${path}`, options);
      const json = await response.json();
      return json;
    } catch (error) {
      console.log(`${method} ${path} → ERROR: ${error.message}`);
      throw error;
    }
  }
}
