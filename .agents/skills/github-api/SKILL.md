---
name: github-api
description: >
  Use this skill whenever you need to interact with GitHub, such as reading repository contents, fetching issues, creating pull requests, or getting code from GitHub. It covers authenticated (with token) and unauthenticated (without token) requests, rate limits, and falling back to raw.githubusercontent.com. Trigger this when the user asks to "fetch from github", "read github repo", "github api", or work with GitHub issues/PRs.
---
# GitHub API Interaction Skill

This skill provides comprehensive guidance on how to effectively interact with GitHub using its REST API (v3), GraphQL API (v4), and raw content fallbacks. When users ask you to fetch code from GitHub, analyze a repository, or interact with issues/PRs, you should follow these guidelines to ensure reliability and avoid rate-limiting issues.

## 1. Authentication Strategies

GitHub allows both authenticated and unauthenticated access, but with vastly different limits. Being mindful of these limits prevents unexpected failures.

### Unauthenticated Requests (No Token)
- **Rate Limit:** 60 requests per hour per IP address.
- **When to use:** Ideal for quick, infrequent reads of public repository metadata (like listing directory contents once).
- **Headers:** 
  ```http
  Accept: application/vnd.github.v3+json
  ```
- **The Catch:** You will hit rate limits very quickly if you iterate through multiple files or make frequent requests. If you get a 403 Forbidden with a rate limit message, you must adapt (see fallback below or ask for a token).

### Authenticated Requests (With Token)
- **Rate Limit:** 5,000 requests per hour for standard personal access tokens.
- **When to use:** Required for any write operations (creating issues, PRs, etc.), for reading private repositories, or when making high-volume requests.
- **Headers:**
  ```http
  Accept: application/vnd.github.v3+json
  Authorization: Bearer <YOUR_GITHUB_TOKEN>
  X-GitHub-Api-Version: 2022-11-28
  ```
- **Tip:** Look for a `GITHUB_TOKEN` environment variable. If one isn't present and you are hitting rate limits, gracefully ask the user if they can provide a token.

## 2. The Raw Content Fallback (Crucial for reading code)

If you only need to read the contents of a file from a public repository, **you should bypass the REST API entirely** and use the raw content domain. 

- **URL Format:** `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`
- **Example:**
  ```bash
  curl -O https://raw.githubusercontent.com/octocat/Hello-World/master/README
  ```
- **Why this is important:** It does not consume your 60/hr GitHub API rate limits. Furthermore, it returns the exact raw text/binary of the file. The standard REST API returns JSON with base64-encoded content, requiring an extra decoding step.
- **Strategy:** Whenever the user asks you to read files or download code from a public GitHub repository, construct the `raw.githubusercontent.com` URL instead of hitting `api.github.com/repos/.../contents/...`.

## 3. Working with the REST API (v3)

Base URL: `https://api.github.com`

When you do need to use the API (e.g., listing a directory, searching issues), here are the standard approaches:

**Fetching Repository Metadata or Directory Listings:**
```bash
curl -H "Accept: application/vnd.github.v3+json" \
     https://api.github.com/repos/{owner}/{repo}/contents/{path}
```
*Note: If the path is a directory, this returns a JSON array of files. You can then use the `download_url` from the response (which points to raw.githubusercontent) to read the individual files.*

**Creating or Updating Data (Requires Token):**
```bash
curl -X POST \
     -H "Accept: application/vnd.github.v3+json" \
     -H "Authorization: Bearer <TOKEN>" \
     -H "X-GitHub-Api-Version: 2022-11-28" \
     https://api.github.com/repos/{owner}/{repo}/issues \
     -d '{"title":"Issue Title","body":"Issue body"}'
```

## 4. GraphQL API (v4)

For complex queries where you need to fetch nested data in a single request (e.g., a PR and all its review comments), GraphQL is highly efficient.

Base URL: `https://api.github.com/graphql`

- **Authentication:** GraphQL *strictly requires* a token. You cannot make unauthenticated GraphQL requests.
- **Example Request:**
  ```bash
  curl -H "Authorization: Bearer <TOKEN>" -X POST -d " \
   { \
     \"query\": \"query { viewer { login } }\" \
   } \
  " https://api.github.com/graphql
  ```

## 5. Best Practices & Error Handling

- **Handling 403 Forbidden:** If you receive a 403 error, check the `X-RateLimit-Remaining` response header. If it's 0, you are rate-limited. Switch to the `raw.githubusercontent.com` fallback if possible, or politely explain to the user that a GitHub token is needed to proceed.
- **Pagination:** GitHub APIs paginate responses (usually 30 items per page). Look for the `Link` header in the response to find the `next` page URL. You can append `?per_page=100` to your URLs to fetch the maximum number of items per request and save API calls.
- **Decoding Base64:** If you must read file content via the REST API, remember that the `content` field in the JSON response is base64-encoded and may contain newlines (`\n`) which need to be handled during decoding.
