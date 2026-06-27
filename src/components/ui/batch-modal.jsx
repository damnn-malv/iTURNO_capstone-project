import React from "react";

const BATCHES = [
  { name: "Batch 1", label: "Batch 1 (6am-3pm)", color: "border-blue-300 hover:bg-blue-50" },
  { name: "Batch 2", label: "Batch 2 (3pm-9pm)", color: "border-green-300 hover:bg-green-50" },
];

function BatchModal({ ticket, onBatchSelect, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Select Batch</h2>
              <p className="text-sm text-gray-600 mt-1">Ticket: {ticket.id}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 p-4 rounded">
            <p className="text-sm text-gray-600">Route: {ticket.route}</p>
            <p className="text-sm text-gray-600 mt-1">Amount: ${ticket.collection_amount || "0"}</p>
          </div>

          <div className="space-y-3">
            {BATCHES.map(({ name, label, color }) => (
              <button
                key={name}
                onClick={() => onBatchSelect(name)}
                className={`w-full p-4 border-2 ${color} rounded-lg transition text-left`}
              >
                <p className="font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-600 mt-1">Half-day collection period</p>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default BatchModal;
