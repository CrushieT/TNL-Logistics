import React, { useState } from 'react';
import { apiClient } from '../api/client';

/**
 * ShipmentForm Component.
 * Enables registration/creation of a new Shipment via the backend API.
 */
export default function ShipmentForm({ onShipmentCreated }) {
	const [formData, setFormData] = useState({
		clientId: '',
		origin: '',
		destination: ''
	});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [success, setSuccess] = useState(false);

	const handleChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value
		}));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
		setSuccess(false);

		// Basic validation
		if (!formData.clientId || !formData.origin || !formData.destination) {
			setError('All fields are required.');
			setLoading(false);
			return;
		}

		try {
			const payload = {
				clientId: parseInt(formData.clientId, 10),
				origin: formData.origin,
				destination: formData.destination
			};

			const response = await apiClient.post('/api/v1/shipments', payload);
			
			setSuccess(true);
			setFormData({ clientId: '', origin: '', destination: '' });
			
			if (onShipmentCreated) {
				onShipmentCreated(response.data);
			}
		} catch (err) {
			setError(err.response?.data?.message || 'Failed to register shipment. Please check backend connection.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="max-w-md w-full bg-white shadow-md rounded-lg p-6 border border-gray-100">
			<h2 className="text-xl font-bold text-gray-800 mb-4">Register New Shipment</h2>
			
			{success && (
				<div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md border border-green-200 text-sm">
					Shipment registered successfully!
				</div>
			)}
			
			{error && (
				<div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md border border-red-200 text-sm">
					{error}
				</div>
			)}

			<form onSubmit={handleSubmit} className="space-y-4">
				<div>
					<label className="block text-sm font-semibold text-gray-700 mb-1">
						Client ID
					</label>
					<input
						type="number"
						name="clientId"
						value={formData.clientId}
						onChange={handleChange}
						className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
						placeholder="e.g. 1"
						required
					/>
				</div>

				<div>
					<label className="block text-sm font-semibold text-gray-700 mb-1">
						Origin Address
					</label>
					<input
						type="text"
						name="origin"
						value={formData.origin}
						onChange={handleChange}
						className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
						placeholder="e.g. Warehouse A, New York"
						required
					/>
				</div>

				<div>
					<label className="block text-sm font-semibold text-gray-700 mb-1">
						Destination Address
					</label>
					<input
						type="text"
						name="destination"
						value={formData.destination}
						onChange={handleChange}
						className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
						placeholder="e.g. 123 Main St, Boston"
						required
					/>
				</div>

				<button
					type="submit"
					disabled={loading}
					className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-150 disabled:bg-blue-300"
				>
					{loading ? 'Submitting...' : 'Register Shipment'}
				</button>
			</form>
		</div>
	);
}
