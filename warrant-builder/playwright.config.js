const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60000,
  use: { baseURL: "http://127.0.0.1:8765" },
  webServer: {
    command: "python3 -m http.server 8765 --bind 127.0.0.1",
    port: 8765,
    reuseExistingServer: true
  }
});
