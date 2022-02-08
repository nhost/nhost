export function searchStringInArray(str, strArray) {
  for (let j = 0; j < strArray.length; j++) {
    if (strArray[j].match(str)) return true
  }
  return false
}
