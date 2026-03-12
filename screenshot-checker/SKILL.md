---
name: screenshot-checker
description: Automatically retrieves and analyzes the latest N screenshots from the system's Screenshots folder. Use when the user asks to "check screenshots" or uses the "/screenshot N" command.
---

# Screenshot Checker

Retrieves the latest N screenshots from `/home/mark/Pictures/Screenshots`, copies them to the workspace, and allows for analysis.

## Workflow

1.  **Retrieve Screenshots**: Run the `get_latest_screenshots.cjs` script with the desired number `N`.
    ```bash
    node scripts/get_latest_screenshots.cjs <N>
    ```
2.  **Read and Analyze**: Use the `read_file` tool on the reported local paths to view and analyze the images.
3.  **Report Findings**: Provide insights based on the visual content of the screenshots.

## Resources

- **Scripts**: `scripts/get_latest_screenshots.cjs` - Lists and copies the latest N screenshots.
