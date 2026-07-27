const unit = new Bimp(
  9,
  10,
  [
    1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 3, 3, 3,
    1, 1, 9, 5, 5, 5, 9, 9, 9, 9, 9, 9, 9, 9, 9, 6, 6, 6, 9, 9, 1, 3, 3, 3, 1,
    1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 3, 3,
    3, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1,
  ],
  [
    { color: "#fbacda", label: "0 miss" },
    { color: "#08ccab", label: "1 front knit" },
    { color: "#eb4034", label: "2 front tuck" },
    { color: "#079e85", label: "3 back knit" },
    { color: "#b03027", label: "4 back tuck" },
    { color: "#fcff46", label: "5 ftb xfer" },
    { color: "#afff46", label: "6 btf xfer" },
    { color: "#d48cff", label: "7 front drop" },
    { color: "#8050c0", label: "8 back drop" },
    { color: "#1a1a1a", label: "9 empty" },
  ],
);

// Iterate over the bitmap and assign either the first yarn (1) or "Null" if it is a transfer row
const yarnFeeder = Array.from({ length: unit.height }, (_, y) => {
  let hasTransfer = false;
  let hasYarn = false;
  for (let x = 0; x < unit.width; x++) {
    const op = unit.pixel(x, y);
    if (op == 9 || op == 5 || op == 6) hasTransfer = true;
    else hasYarn = true;
  }
  if (hasTransfer && hasYarn)
    // We can't mix transfer and yarn operations in the same row
    throw new Error(`Row ${y} mixes transfer and yarn operations`);

  // If only yarn actions are seen, return 1, else return null to represent a transfer row
  return hasYarn ? 1 : null;
});

return {
  ops: unit,
  yarnFeeder,
  palette: ["#b59fd5"],
};
