# Tuneviq plugin for Claude Code

Connects Claude Code to the read-only MCP connector of your own Tuneviq installation. Open source under the MIT licence (see `LICENSE`). It contains no product code, keys or customer data, no hooks, and no telemetry; it talks only to the address you set.

Your Tuneviq administrator must switch the AI clients connector on first (see `docs/operator-mcp.md` of your installation). Then create a personal access token under Account > AI clients and set:

```
export TUNEVIQ_MCP_URL="<your Tuneviq address>/mcp"
export TUNEVIQ_MCP_TOKEN="<token>"
```

Install:

```
/plugin marketplace add tuneviq/mcp
/plugin install tuneviq@tuneviq
```

Use only AI clients and accounts approved by your organisation. Data read through the connector goes to the provider of the AI client you use, after the AI data policy of your installation, and not through EASYY.
