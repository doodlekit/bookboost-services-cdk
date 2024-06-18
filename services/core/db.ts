export const pascalToSnakeKeys = (obj: any) => {
  const newObj: any = {}
  for (const key in obj) {
    const newKey = key
      .split(/\.?(?=[A-Z])/)
      .join('_')
      .toLowerCase()
    newObj[newKey] = obj[key]
  }
  return newObj
}

export const getUpdateExpression = (record: any) => {
  return Object.keys(record)
    .filter((i) => !!record[i])
    .map((i) => `#${i} = :value${i}`)
    .join(', ')
}

export const getExpressionAttributeValues = (record: any) => {
  return Object.keys(record)
    .filter((i) => !!record[i])
    .reduce(
      (acc, i) => ({
        ...acc,
        [`:value${i}`]: record[i]
      }),
      {}
    )
}

export const getExpressionAttributeNames = (record: any) => {
  return Object.keys(record)
    .filter((i) => !!record[i])
    .reduce(
      (acc, i) => ({
        ...acc,
        [`#${i}`]: i
      }),
      {}
    )
}
