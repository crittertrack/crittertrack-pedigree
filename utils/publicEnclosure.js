const formatPublicEnclosure = (enclosure, locations = []) => {
    const building = locations.find((location) => location.type === 'building');
    const room = locations.find((location) => location.type === 'room');

    return {
        detailsShared: true,
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
            assignedSupplies: (task.assignedSupplies || []).map(({ supplyName, quantity, unit }) => ({
                supplyName,
                quantity,
                ...(unit ? { unit } : {}),
            })),
        })),
    };
};

const formatPublicEnclosureSummary = (enclosure) => ({
    detailsShared: false,
    name: enclosure.name,
    enclosureType: enclosure.enclosureType || null,
    purpose: enclosure.purpose || null,
    dimensions: enclosure.dimensions || null,
    tempMin: enclosure.tempMin ?? null,
    tempMax: enclosure.tempMax ?? null,
    temperatureUnit: enclosure.temperatureUnit || 'C',
    humidityMin: enclosure.humidityMin ?? null,
    humidityMax: enclosure.humidityMax ?? null,
    lightsOnTime: enclosure.lightsOnTime || null,
    lightsOffTime: enclosure.lightsOffTime || null,
    lightingType: enclosure.lightingType || null,
    bedding: enclosure.bedding || null,
    enrichment: enclosure.enrichment || null,
    imageUrl: enclosure.imageUrl || null,
});

module.exports = { formatPublicEnclosure, formatPublicEnclosureSummary };
