# Getting Started with Speakr

**Follow these steps to launch the speakr on your local machine:**

### Step 1: Add your API key

- Visit the [Speakr](https://speakr.online), and navigate to the playground to obtain your API key.
- Once you have the key, create or update your `config.env` file in the server directory by adding the following line:

```bash
SPEAKR_APIKEY = your_api_key_here
```

### Step 2: Install dependencies and Start the client application and server

Use the following command to start the application in development mode with HTTPS enabled:

## Client

```bash
cd client
npm install
npm start
```

## Server

```bash
cd server
npm install
npm start
```
