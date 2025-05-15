import React, { useState } from "react";
import { getCompassHeading, loadTouristPlaces, updateTouristPlaces } from "../utils/compassHeading";
import { logger } from "../utils/logger";

const Home = () => {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [kmValue, setKmValue] = useState(1);
  const [status, setStatus] = useState("");
  const [visiblePlaces, setVisiblePlaces] = useState([]);

  const handleCompassClick = async () => {
    setIsLoading(true);
    logger.log('Fetching places within', kmValue, 'km');
    
    try {
      let data = await loadTouristPlaces(kmValue, setIsLoading);
      logger.log('Places loaded:', data);
      
      const heading = await getCompassHeading();
      logger.log('Compass heading:', heading);
      
      if (heading != null) {
        data = await updateTouristPlaces(heading, data);
        setVisiblePlaces(data);
        setStatus("Places loaded successfully.");
        logger.log('Updated places based on heading:', data);
      } else {
        logger.error('Failed to get compass heading');
      }
    } catch (err) {
      logger.error('Error fetching places:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto w-full">
      <div className="flex flex-col items-center gap-4 mb-6">
        <div>
          Within
          <input
            id="kmValue"
            type="number"
            value={kmValue}
            onChange={(e) => setKmValue(e.target.value)}
            className="w-28 p-2 border-2 border-blue-500 rounded-md text-center text-lg focus:border-green-500 focus:ring-2 focus:ring-green-300 outline-none mx-3"
            min="0.1"
            step="0.1"
          />
          km
        </div>
        <button
          onClick={handleCompassClick}
          disabled={isLoading}
          className={`bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold px-6 py-3 rounded-lg shadow-md w-full max-w-xs transition duration-150 ${
            isLoading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {isLoading ? "Loading..." : "Fetch Places"}
        </button>
        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
            {error}
          </div>
        )}
        {isLoading && (
          <div className="flex justify-center mb-4">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        )}
        <div className="mt-4 text-center text-lg font-medium text-gray-700">
          {status}
        </div>
        <div className="mt-6">
          {visiblePlaces.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {visiblePlaces.map((place, index) => (
                  <PlaceCard key={index} place={place} />
                ))}
            </div>
          ) : (
            <p className="text-center text-gray-500">No places in view.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
