# Project Rules and Context

## Worker Configuration
- **DO NOT** modify the AI prompts or instructions sent to the worker/API (e.g., in `src/pages/Chat.tsx`) unless explicitly requested to change the logic. The user wants to keep strict control over these prompts.
- Switching between different Cloudflare workers is possible and can be done by updating the backend configuration/environment variables when requested.

## Project Categories
- Maintain the "Mise en lien du vécu" philosophy.
- The standard labels for life spheres in this project are: "Familiale", "Sociale", "Amoureuse", "Professionnelle".
