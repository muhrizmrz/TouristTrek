import React from "react";

const PlaceCard = ({ place }) => (
  <div className="bg-white shadow-md rounded-lg p-4 border border-gray-200 mb-4">
    <h2 className="text-xl font-semibold text-blue-700 mb-1">{place.name}</h2>
    <p className="text-lg">
      <strong>Bearing:</strong> {place.bearing.toFixed(1)}°
    </p>
    <p className="text-lg">
      <strong>Address:</strong> {place.address}
    </p>
  </div>
);

export default PlaceCard;
