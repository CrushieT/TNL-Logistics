import React from 'react';
import useSWR, { mutate } from 'swr';
import { apiClient } from '../api/client';
import ShipmentForm from '../components/ShipmentForm';

const fetcher = (url) => apiClient.get(url).then((res) => res.data);

/**
 * Dashboard Page.
 * Displays list of shipments fetched from the backend API alongside
 * the shipment registration form. Uses SWR for reactive cache invalidation.
 */
export default function Dashboard() {
	const { data: shipments, error, isLoading } = useSWR('/api/v1/shipments', fetcher, {
		refreshInterval: 5000 // Poll every 5 seconds for real-time dashboard updates
	});

	const handleShipmentCreated = () => {
		// Revalidate / refetch list of shipments
		mutate('/api/v1/shipments');
	};

	return (
		<div className="min-h-screen bg-gray-50 text-gray-800 p-8">
			<header className="mb-8">
				<h1 className="text-3xl font-extrabold text-gray-900">TNL Logistics Admin</h1>
				<p className="text-gray-500 text-sm mt-1">
					Manage shipments, billings, and track operations in real-time.
				</p>
			</header>

			<main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
				{/* Register Form Section */}
				<div className="lg:col-span-1">
					<ShipmentForm onShipmentCreated={handleShipmentCreated} />
				</div>

				{/* Active Shipments List Section */}
				<div className="lg:col-span-2 bg-white shadow-md rounded-lg p-6 border border-gray-100">
					<h2 className="text-xl font-bold text-gray-800 mb-4">Active Shipments</h2>
					
					{isLoading && (
						<div className="flex items-center justify-center py-10">
							<span className="text-gray-500 text-sm">Loading shipments...</span>
						</div>
					)}

					{error && (
						<div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200 text-sm">
							Failed to fetch shipments. Ensure the backend API is running.
						</div>
					)}

					{!isLoading && !error && (!shipments || shipments.length === 0) && (
						<div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-200 rounded-lg">
							<span className="text-gray-400 mb-2">No shipments found.</span>
							<span className="text-gray-500 text-xs">Use the registration form to create one.</span>
						</div>
					)}

					{!isLoading && !error && shipments && shipments.length > 0 && (
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-gray-200">
								<thead className="bg-gray-50">
									<tr>
										<th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">ID</th>
										<th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Client ID</th>
										<th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Origin</th>
										<th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Destination</th>
										<th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
									</tr>
								</thead>
								<tbody className="bg-white divide-y divide-gray-200 text-sm">
									{shipments.map((shipment) => (
										<tr key={shipment.id} className="hover:bg-gray-50">
											<td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">#{shipment.id}</td>
											<td className="px-4 py-3 whitespace-nowrap text-gray-500">{shipment.clientId}</td>
											<td className="px-4 py-3 whitespace-nowrap text-gray-500 truncate max-w-xs">{shipment.origin}</td>
											<td className="px-4 py-3 whitespace-nowrap text-gray-500 truncate max-w-xs">{shipment.destination}</td>
											<td className="px-4 py-3 whitespace-nowrap">
												<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
													shipment.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
													shipment.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-800' :
													shipment.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
													'bg-yellow-100 text-yellow-800'
												}`}>
													{shipment.status}
												</span>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</main>
		</div>
	);
}
