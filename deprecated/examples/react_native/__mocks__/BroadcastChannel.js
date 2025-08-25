class MockBroadcastChannel {
  constructor(channelName) {
    this.name = channelName;
    this.listeners = [];
  }

  postMessage(message) {
    setTimeout(() => {
      this.listeners.forEach(listener => listener({data: message}));
    }, 0);
  }

  close() {
    // Mock close behavior
  }

  addEventListener(event, listener) {
    if (event === 'message') {
      this.listeners.push(listener);
    }
  }

  removeEventListener(event, listener) {
    if (event === 'message') {
      this.listeners = this.listeners.filter(l => l !== listener);
    }
  }
}

module.exports = MockBroadcastChannel;
