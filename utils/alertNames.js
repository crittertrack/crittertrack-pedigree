const formatAnimalName = (animal) => {
    if (!animal) return '';
    return [animal.prefix, animal.name, animal.suffix]
        .filter((part) => typeof part === 'string' && part.trim())
        .map((part) => part.trim())
        .join(' ') || animal.id_public || '';
};

const formatAlertNames = (names, maxNames = 3) => {
    const uniqueNames = [...new Set((names || []).filter((name) => typeof name === 'string' && name.trim()).map((name) => name.trim()))];
    if (!uniqueNames.length) return '';
    const shown = uniqueNames.slice(0, maxNames).map((name) => name.length > 60 ? `${name.slice(0, 57)}...` : name);
    if (uniqueNames.length > maxNames) shown.push(`+${uniqueNames.length - maxNames} more`);
    return shown.join(', ');
};

const formatAlertDigest = (count, names) => {
    const items = `${count} item${count === 1 ? '' : 's'} due`;
    const formattedNames = formatAlertNames(names);
    return formattedNames ? `${items}: ${formattedNames}. Tap to review.` : `${items}. Tap to review.`;
};

module.exports = { formatAnimalName, formatAlertNames, formatAlertDigest };
