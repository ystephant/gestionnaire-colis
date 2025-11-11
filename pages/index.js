import React, { useState } from "react";

const LOCKER_LOGOS = {
  "mondial-relay": "/logos/mondial-relay.png",
  "vinted-go": "/logos/vinted-go.png",
  "relais-colis": "/logos/relais-colis.png",
  pickup: "/logos/pickup.png",
};

const getLockerName = (type) => {
  switch (type) {
    case "mondial-relay":
      return "Mondial Relay";
    case "vinted-go":
      return "Vinted GO";
    case "relais-colis":
      return "Relais Colis";
    case "pickup":
      return "Pickup";
    default:
      return type;
  }
};

export default function AddLockerForm({ onSubmit }) {
  const [lockerType, setLockerType] = useState("");
  const [lockerAddress, setLockerAddress] = useState("");
  const [lockerNote, setLockerNote] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!lockerType || !lockerAddress) return;
    onSubmit({ type: lockerType, address: lockerAddress, note: lockerNote });
    setLockerType("");
    setLockerAddress("");
    setLockerNote("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-4 rounded-xl shadow-md space-y-4"
    >
      <h2 className="text-lg font-semibold text-gray-800">
        Ajouter un point relais
      </h2>

      {/* Type de locker */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          Choisis le transporteur :
        </p>
        <div className="grid grid-cols-2 gap-2">
          {Object.keys(LOCKER_LOGOS).map((type) => (
            <label
              key={type}
              className={`flex items-center gap-3 cursor-pointer bg-white p-3 rounded-lg border-2 transition ${
                lockerType === type
                  ? "border-indigo-400"
                  : "border-gray-200 hover:border-indigo-300"
              }`}
            >
              <input
                type="radio"
                name="lockerType"
                value={type}
                checked={lockerType === type}
                onChange={(e) => setLockerType(e.target.value)}
                className="w-4 h-4 text-indigo-600"
              />
              <img
                src={LOCKER_LOGOS[type]}
                alt={getLockerName(type)}
                className="h-6 object-contain"
              />
              <span className="text-sm font-medium text-gray-700">
                {getLockerName(type)}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Adresse */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Adresse du point relais
        </label>
        <input
          type="text"
          value={lockerAddress}
          onChange={(e) => setLockerAddress(e.target.value)}
          placeholder="Ex : 12 rue du Commerce, Lyon"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
          required
        />
      </div>

      {/* Note */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Note (facultatif)
        </label>
        <textarea
          value={lockerNote}
          onChange={(e) => setLockerNote(e.target.value)}
          placeholder="Précise un code ou un détail utile..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
        />
      </div>

      {/* Bouton de validation */}
      <button
        type="submit"
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition"
      >
        Ajouter
      </button>
    </form>
  );
}
