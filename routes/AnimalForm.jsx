import React, { useState, useEffect } from 'react';
import { determineHealthStatus } from '../../utils/healthUtils';
import { Info } from 'lucide-react';

// This is a simplified representation of the AnimalForm, focusing on the health status suggestion logic.
// You would integrate this logic into your existing, more complex AnimalForm.
const AnimalForm = ({ initialAnimal, onSave }) => {
    const [animalData, setAnimalData] = useState(initialAnimal || {
        healthStatus: 'Good',
        medicalConditions: [],
        medications: [],
        quarantineStatus: { active: false, reason: '', endDate: '' }
    });

    // State to hold the suggested health status
    const [suggestedHealthStatus, setSuggestedHealthStatus] = useState(null);

    // useEffect to calculate and suggest health status changes
    useEffect(() => {
        // Calculate the status based on current form data
        const calculatedStatus = determineHealthStatus(animalData);

        // If the calculated status is different from the one saved, suggest an update
        if (calculatedStatus !== animalData.healthStatus && calculatedStatus !== 'Unknown') {
            setSuggestedHealthStatus(calculatedStatus);
        } else {
            setSuggestedHealthStatus(null); // Otherwise, clear any existing suggestion
        }
    }, [animalData.medicalConditions, animalData.medications, animalData.quarantineStatus, animalData.healthStatus]); // Dependencies that affect health status

    const handleFieldChange = (field, value) => {
        setAnimalData(prev => ({ ...prev, [field]: value }));
    };

    // Function to apply the suggested status
    const applySuggestedStatus = () => {
        if (suggestedHealthStatus) {
            handleFieldChange('healthStatus', suggestedHealthStatus);
            setSuggestedHealthStatus(null); // Clear suggestion after applying
        }
    };

    // --- Mock functions to simulate adding/updating health records ---
    const addMedication = () => {
        const newMed = { medication: 'Amoxicillin', dosage: '10mg', frequency: 'daily', status: 'active' };
        handleFieldChange('medications', [...animalData.medications, newMed]);
    };

    const addCriticalCondition = () => {
        const newCondition = { condition: 'Severe Infection', status: 'active', severity: 'critical' };
        handleFieldChange('medicalConditions', [...animalData.medicalConditions, newCondition]);
    };

    const toggleQuarantine = () => {
        const newQuarantineStatus = { ...animalData.quarantineStatus, active: !animalData.quarantineStatus.active };
        handleFieldChange('quarantineStatus', newQuarantineStatus);
    };

    const clearHealthRecords = () => {
        setAnimalData(prev => ({
            ...prev,
            medicalConditions: [],
            medications: [],
            quarantineStatus: { ...prev.quarantineStatus, active: false }
        }));
    };
    // --- End mock functions ---

    return (
        <div className="p-6 bg-gray-50 rounded-lg shadow-md max-w-2xl mx-auto border">
            <h2 className="text-xl font-bold mb-6 text-gray-800">Animal Health Form</h2>

            {/* Health Status Field with Suggestion */}
            <div className="mb-6">
                <label htmlFor="healthStatus" className="block text-sm font-medium text-gray-700 mb-1">
                    Health Status
                </label>
                <select
                    id="healthStatus"
                    value={animalData.healthStatus}
                    onChange={(e) => handleFieldChange('healthStatus', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                >
                    <option>Good</option>
                    <option>Under Observation</option>
                    <option>Under Treatment</option>
                    <option>Quarantined</option>
                    <option>Critical</option>
                </select>

                {/* Suggestion UI */}
                {suggestedHealthStatus && (
                    <div className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-400 flex items-center justify-between rounded-r-md">
                        <div className="flex items-center">
                            <Info size={18} className="text-blue-500 mr-3 flex-shrink-0" />
                            <p className="text-sm text-blue-800">
                                Based on the records, we suggest changing the status to: <strong>{suggestedHealthStatus}</strong>
                            </p>
                        </div>
                        <button
                            onClick={applySuggestedStatus}
                            className="ml-4 px-3 py-1 text-sm font-semibold text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Apply
                        </button>
                    </div>
                )}
            </div>

            {/* Mock controls to test the logic */}
            <div className="mt-8 pt-4 border-t">
                <h3 className="text-md font-semibold text-gray-600 mb-2">Test Controls</h3>
                <div className="flex flex-wrap gap-2">
                    <button onClick={addMedication} className="px-3 py-1.5 text-sm bg-green-100 text-green-800 rounded-md hover:bg-green-200">Add Active Medication</button>
                    <button onClick={addCriticalCondition} className="px-3 py-1.5 text-sm bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200">Add Critical Condition</button>
                    <button onClick={toggleQuarantine} className="px-3 py-1.5 text-sm bg-orange-100 text-orange-800 rounded-md hover:bg-orange-200">Toggle Quarantine</button>
                    <button onClick={clearHealthRecords} className="px-3 py-1.5 text-sm bg-red-100 text-red-800 rounded-md hover:bg-red-200">Clear Health Records</button>
                </div>
            </div>

            <div className="mt-8">
                <button onClick={() => onSave(animalData)} className="w-full p-3 bg-primary text-black font-bold rounded-md hover:bg-primary/90">
                    Save Animal
                </button>
            </div>
        </div>
    );
};

export default AnimalForm;