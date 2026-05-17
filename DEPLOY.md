# Deploying Eye Scan

This repo is set up for a single-service Docker deploy. The FastAPI backend serves
the built React app and exposes the diagnosis endpoint at `/api/diagnose`.

## Render

1. Push this repo to GitHub.
2. Make sure the model is included in git:

   ```sh
   git add -f backend/final_retina_model.pth
   ```

3. In Render, create a new Blueprint or Web Service from the GitHub repo.
4. Render will read `render.yaml` and build from `Dockerfile`.
5. Open the deployed URL and test a retinal image upload.

## Local Production Check

```sh
docker build -t eye-scan .
docker run --rm -p 8000:8000 eye-scan
```

Then open `http://localhost:8000`.
