# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AR Navigation</title>
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- React and ReactDOM CDNs -->
  <script src="https://cdn.jsdelivr.net/npm/react@18.2.0/umd/react.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/react-dom@18.2.0/umd/react-dom.production.min.js"></script>
  <!-- Babel CDN for JSX -->
  <script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7.22.9/babel.min.js"></script>
</head>
<body class="bg-gray-100 min-h-screen flex flex-col items-center justify-center p-4">
  <div id="root"></div>

  <script type="text/babel">
    const { useState, useEffect } = React;

    const GEOAPIFY_API_KEY = "YOUR_GEOAPIFY_API_KEY"; // Replace with your Geoapify API key

    // Main App component
    const App = () => {

      // Single reverse geocoding
      const reverseGeocodeSingle = async (place) => {
        try {
          const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${place.lat}&lon=${place.lon}&apiKey=${GEOAPIFY_API_KEY}`;
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const contentType = response.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const text = await response.text();
            throw new Error(`Expected JSON, got ${contentType}: ${text.slice(0, 100)}`);
          }
          const data = await response.json();
          const result = data.features[0]?.properties || {};
          return {
            ...place,
            address: result.formatted || place.address || "No address",
          };
        } catch (err) {
          console.error(`Single geocoding error for ${place.name}:`, err.message);
          return place;
        }
      };

      // Batch reverse geocoding
      const reverseGeocodeBatch = async (places) => {
        if (!places.length) return places;
        if (!GEOAPIFY_API_KEY || GEOAPIFY_API_KEY === "YOUR_GEOAPIFY_API_KEY") {
          console.error("Invalid Geoapify API key");
          setError("Invalid Geoapify API key. Please configure a valid key.");
          return places;
        }

        const validPlaces = places.filter(
          (place) =>
            typeof place.lat === "number" &&
            typeof place.lon === "number" &&
            place.lat >= -90 &&
            place.lat <= 90 &&
            place.lon >= -180 &&
            place.lon <= 180
        );
        if (!validPlaces.length) {
          console.warn("No valid coordinates for batch geocoding");
          setError("No valid coordinates to geocode.");
          return places;
        }
        console.log("Valid coordinates for batch:", validPlaces.length);

        const body = validPlaces.map((place) => ({ lon: place.lon, lat: place.lat }));
        const maxRetries = 3;
        const maxAttempts = 120;
        let retryCount = 0;

        while (retryCount < maxRetries) {
          try {
            console.log(`Attempting batch job (retry ${retryCount + 1}/${maxRetries})`);
            const createResponse = await fetch(
              `https://api.geoapify.com/v1/batch/geocode/reverse?apiKey=${GEOAPIFY_API_KEY}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              }
            );
            if (!createResponse.ok) {
              const text = await createResponse.text();
              throw new Error(`HTTP ${createResponse.status}: ${text.slice(0, 100)}`);
            }
            const contentType = createResponse.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
              const text = await createResponse.text();
              throw new Error(`Expected JSON, got ${contentType}: ${text.slice(0, 100)}`);
            }
            const createData = await createResponse.json();
            if (createData.status !== "pending") {
              throw new Error("Batch job creation failed: " + (createData.message || "Unknown error"));
            }
            const jobId = createData.id;
            const resultUrl = createData.url;
            console.log("Batch job created:", { jobId, resultUrl });

            let attempts = 0;
            while (attempts < maxAttempts) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              const statusResponse = await fetch(resultUrl);
              if (!statusResponse.ok) {
                const text = await statusResponse.text();
                throw new Error(`Polling HTTP ${statusResponse.status}: ${text.slice(0, 100)}`);
              }
              const statusContentType = statusResponse.headers.get("content-type");
              if (!statusContentType || !statusContentType.includes("application/json")) {
                const text = await statusResponse.text();
                throw new Error(`Polling expected JSON, got ${statusContentType}: ${text.slice(0, 100)}`);
              }
              const statusData = await statusResponse.json();
              console.log(`Job ${jobId} status: ${statusData.status}, attempt ${attempts + 1}/${maxAttempts}`);

              if (statusData.status === "completed") {
                const updatedPlaces = validPlaces.map((place, index) => {
                  const result = statusData.results[index]?.properties || {};
                  return {
                    ...place,
                    address: result.formatted || place.address || "No address",
                  };
                });
                console.log("Geocoded addresses:", updatedPlaces.map((p) => p.address));
                return places.map((p) =>
                  updatedPlaces.find((up) => up.lat === p.lat && up.lon === p.lon) || p
                );
              } else if (statusData.status === "failed") {
                throw new Error("Batch job failed: " + (statusData.message || "Unknown error"));
              }
              attempts++;
            }
            throw new Error(`Batch job timed out after ${maxAttempts} attempts`);
          } catch (err) {
            console.error(`Batch geocoding error (retry ${retryCount + 1}):`, err.message);
            retryCount++;
            if (retryCount === maxRetries) {
              setError("Failed to fetch addresses after retries. Using fallback.");
              console.warn("Switching to single-request geocoding");
              const updatedPlaces = await Promise.all(
                validPlaces.map((place) => reverseGeocodeSingle(place))
              );
              return places.map((p) =>
                updatedPlaces.find((up) => up.lat === p.lat && up.lon === p.lon) || p
              );
            }
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
        return places;
      };

      // Update visible places based on heading
      

      // Load tourist places
      

      // Handle button click
      

      // Initial load
      useEffect(() => {
        loadTouristPlaces();
      }, []);

      return (
        <div className="max-w-4xl w-full bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-center text-blue-700 mb-6">
            AR Navigation
          </h1>
          {error && (
            <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>
          )}
          {isLoading && (
            <div className="flex justify-center mb-4">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          )}
          <div className="mb-4">
            <label htmlFor="kmValue" className="block text-lg font-medium text-gray-700">
              Search Radius (km):
            </label>
            <input
              id="kmValue"
              type="number"
              value={kmValue}
              onChange={(e) => setKmValue(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              min="0.1"
              step="0.1"
            />
          </div>
          <button
            onClick={handleCompassClick}
            disabled={isLoading}
            className={`w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isLoading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {isLoading ? "Loading..." : "Fetch Places & Heading"}
          </button>
          <div className="mt-4 text-center text-lg font-medium text-gray-700">
            {status}
          </div>
          <div className="mt-6">
            {visiblePlaces.length > 0 ? (
              visiblePlaces.map((place, index) => (
                <PlaceCard key={index} place={place} />
              ))
            ) : (
              <p className="text-center text-gray-500">No places in view.</p>
            )}
          </div>
        </div>
      );
    };

    // Render the app
    ReactDOM.render(<App />, document.getElementById("root"));
  </script>
</body>
</html>