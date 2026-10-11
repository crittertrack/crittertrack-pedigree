const formatPublicEnclosure = (enclosure, locations = []) => {
    const building = locations.find((location) => location.type === 'building');
    const room = locations.find((location) => location.type === 'room');

    return {
        name: enclosure.name,
        enclosureType: enclosure.enclosureType,
        purpose: enclosure.purpose,
        purposeDescription: enclosure.purposeDescription,
        dimensions: enclosure.dimensions,
        capacity: enclosure.capacity,
        tempMin: enclosure.tempMin,
        tempMax: enclosure.tempMax,
        temperatureUnit: enclosure.temperatureUnit,
        humidityMin: enclosure.humidityMin,
        humidityMax: enclosure.humidityMax,
        lightsOnTime: enclosure.lightsOnTime,
        lightsOffTime: enclosure.lightsOffTime,
        lightTimeFormat: enclosure.lightTimeFormat,
        lightingType: enclosure.lightingType,
        bedding: enclosure.bedding,
        enrichment: enclosure.enrichment,
        notes: enclosure.notes,
        tags: enclosure.tags,
        speciesLabels: enclosure.speciesLabels,
        imageUrl: enclosure.imageUrl,
        buildingName: building?.name || null,
        roomName: room?.name || null,
        cleaningTasks: (enclosure.cleaningTasks || []).map((task) => ({
            _id: task._id,
            type: task.type,
            taskName: task.taskName,
            lastDoneDate: task.lastDoneDate,
            frequency: task.frequency,
            frequencyDays: task.frequencyDays,
            frequencyUnit: task.frequencyUnit,
            notes: task.notes,
            assignedSupplies: (task.assignedSupplies || []).map(({ supplyName, quantity }) => ({ supplyName, quantity })),
        })),
    };
};

module.exports = { formatPublicEnclosure };
