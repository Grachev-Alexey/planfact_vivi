const toCamelCase = (row) => {
  const newRow = {};
  for (const key in row) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newRow[camelKey] = row[key];
  }
  return newRow;
};

module.exports = { toCamelCase };