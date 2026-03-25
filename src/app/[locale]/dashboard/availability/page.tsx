import { AvailabilityTab } from "../photographer/AvailabilityTab";

export const dynamic = "force-dynamic";

export default function AvailabilityPage() {
  return (
    <div className="p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold text-gray-900">Availability</h1>
      <p className="mt-1 text-gray-500">Manage when you&apos;re available for photoshoots</p>
      <div className="mt-6">
        <AvailabilityTab />
      </div>
    </div>
  );
}
