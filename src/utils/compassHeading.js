export const getCompassHeading = async () => {
  try {
    if ("AbsoluteOrientationSensor" in window) {
      const sensor = new AbsoluteOrientationSensor({ frequency: 1 });
      return new Promise((resolve, reject) => {
        sensor.addEventListener(
          "reading",
          () => {
            const [x, y, z, w] = sensor.quaternion;
            const yaw = Math.atan2(
              2 * (w * z + x * y),
              1 - 2 * (y * y + z * z)
            );
            const heading = ((yaw * 180) / Math.PI + 360) % 360;
            sensor.stop();
            resolve(heading);
          },
          { once: true }
        );
        sensor.addEventListener("error", (err) => reject(err.error), {
          once: true,
        });
        sensor.start();
      });
    } else if (window.DeviceOrientationEvent) {
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== "granted") throw new Error("Permission denied");
      }
      return new Promise((resolve) => {
        const handler = (event) => {
          const heading =
            event.webkitCompassHeading !== undefined
              ? event.webkitCompassHeading
              : (360 - event.alpha) % 360;
          window.removeEventListener("deviceorientation", handler);
          resolve(heading);
        };
        window.addEventListener("deviceorientation", handler, { once: true });
      });
    } else {
      throw new Error("Compass not supported");
    }
  } catch (err) {
    //   setStatus("Compass not supported on this device.");
    //   setError(err.message);
    console.log(err);
    return null;
  }
};

export const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

export const loadTouristPlaces = async (kmValue, setLoading) => {
  if (!navigator.geolocation) {
    console.log("Geolocation not supported.");
    setLoading(false);
    return;
  }

  let latitude, longitude, parsedKmValue;
  try {
    const position = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(
        res,
        (err) => {
          const msg = err.message || "Failed to get location. Please allow location access.";
          rej(new Error(msg));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
        }
      )
    );

    latitude = position.coords.latitude;
    longitude = position.coords.longitude;
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      isNaN(latitude) ||
      isNaN(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      setLoading(false);
      throw new Error("Invalid geolocation coordinates.");
    }
  } catch (err) {
    console.warn("Geolocation failed, using fallback coordinates:", err.message);
    latitude = 40.748428; // Fallback: New York
    longitude = -73.985654;
    setLoading(false);
    alert(`Location error: ${err.message}`);
  }

  try {
    parsedKmValue = parseFloat(kmValue);
    if (isNaN(parsedKmValue) || parsedKmValue <= 0) {
      throw new Error("Invalid radius. Please enter a positive number.");
    }
    const radius = Math.min(Math.max(0.1, parsedKmValue), 50) * 1000; // 100m to 10km
    console.log("Geolocation and radius:", { latitude, longitude, radius, parsedKmValue });

    const query = `
      [out:json][timeout:25];
      (
        node["leisure"="park"](around:${radius},${latitude},${longitude});
        way["leisure"="park"](around:${radius},${latitude},${longitude});
        relation["leisure"="park"](around:${radius},${latitude},${longitude});
        node["tourism"="museum"](around:${radius},${latitude},${longitude});
        way["tourism"="museum"](around:${radius},${latitude},${longitude});
        relation["tourism"="museum"](around:${radius},${latitude},${longitude});
        node["tourism"="beach"](around:${radius},${latitude},${longitude});
        way["tourism"="beach"](around:${radius},${latitude},${longitude});
        relation["tourism"="beach"](around:${radius},${latitude},${longitude});
        node["tourism"~"attraction|viewpoint"](around:${radius},${latitude},${longitude});
        way["tourism"~"attraction|viewpoint"](around:${radius},${latitude},${longitude});
        relation["tourism"~"attraction|viewpoint"](around:${radius},${latitude},${longitude});
      );
      out center;
    `.trim();
    console.log("Overpass query:", query);

    const response = await fetch(
      "https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: query,
      }
    );
    if (!response.ok) {
      setLoading(false);
      const text = await response.text();
      throw new Error(`Overpass API error (HTTP ${response.status}): ${text}`);
    }
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      setLoading(false);
      const text = await response.text();
      throw new Error(`Expected JSON, got ${contentType}: ${text}`);
    }

    const data = await response.json();
    const newPlaces = data.elements
      .map((place, i) => {
        const lat = place.lat || place.center?.lat;
        const lon = place.lon || place.center?.lon;
        if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
          console.warn(`Skipping place ${i + 1}: Invalid coordinates`, place);
          return null;
        }
        return {
          name:
            place.tags?.name ||
            place.tags?.tourism ||
            place.tags?.leisure ||
            `Place ${i + 1}`,
          bearing: calculateBearing(latitude, longitude, lat, lon),
          address: place.tags?.["addr:street"] || "No address",
          lat,
          lon,
        };
      })
      .filter(Boolean);
    console.log("Fetched places:", newPlaces);

    return newPlaces;
  } catch (err) {
    setLoading(false);
    console.error("Load tourist places error:", err.message);
  }
};

export const updateTouristPlaces = async (deviceHeading, places) => {
  if (places.length === 0) {
    return;
  }

  const fov = 45;

  const minAngle = (deviceHeading - fov + 360) % 360;
  const maxAngle = (deviceHeading + fov) % 360;

  let newVisiblePlaces = places.filter((place) => {
    const bearing = place.bearing;
    let inFov;
    if (minAngle > maxAngle) {
      inFov = bearing >= minAngle || bearing <= maxAngle;
    } else {
      inFov = bearing >= minAngle && bearing <= maxAngle;
    }
    console.log(`Place ${place.name}: bearing=${bearing.toFixed(1)}°, inFov=${inFov}`);
    return inFov;
  });

  // newVisiblePlaces = await reverseGeocodeBatch(newVisiblePlaces);

  if (newVisiblePlaces.length === 0) {
    console.log(`No places in view (Heading: ${Math.round(deviceHeading)}°)`);
    return;
  }

  console.log(
    `Found ${newVisiblePlaces.length} place(s) in view — Heading: ${Math.round(deviceHeading)}°`
  );
  
  return newVisiblePlaces;
};