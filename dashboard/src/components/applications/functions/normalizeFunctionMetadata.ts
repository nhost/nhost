export type FinalFunction = {
  folder: string;
  funcs: Func[];
  nestedLevel: number;
  parentFolder?: string;
};

export type Func = {
  name: string;
  id: string;
  lang: string;
  functionName: string;
  route?: string;
  path?: string;
  createdAt?: string;
  updatedAt?: string;
  createdWithCommitSha?: string;
  formattedCreatedAt?: string;
  formattedUpdatedAt?: string;
};

export const normalizeFunctionMetadata = (functions): FinalFunction[] => {
  const finalFunctions: FinalFunction[] = [
    { folder: 'functions', funcs: [], nestedLevel: 0 },
  ];
  const topLevelFunctionsFolder = finalFunctions[0].funcs;
  functions.forEach((func) => {
    const nestedLevel = func.path?.split('/').length;
    const newFuncToAdd = {
      ...func,
      name: func.path?.split('/')[nestedLevel - 1],
      lang: func.path?.split('.')[1],
      // formattedCreatedAt: `${format(
      //   parseISO(func.createdAt),
      //   'yyyy-MM-dd HH:mm:ss',
      // )}`,
      // formattedUpdatedAt: `${formatDistanceToNowStrict(
      //   parseISO(func.updatedAt),
      //   {
      //     addSuffix: true,
      //   },
      // )}`,
    };

    if (nestedLevel === 2) {
      topLevelFunctionsFolder.push(newFuncToAdd);
    } else if (nestedLevel > 2) {
      const nameOfTheFolder = func.path?.split('/')[nestedLevel - 2];
      const nameOfParentFolder = func.path?.split('/')[nestedLevel - 3];
      const checkForFolderExistence = finalFunctions.find(
        (functionFolder) => functionFolder.folder === nameOfTheFolder,
      );

      if (!checkForFolderExistence) {
        finalFunctions.push({
          folder: nameOfTheFolder,
          funcs: [newFuncToAdd],
          nestedLevel: nestedLevel - 2,
          parentFolder: nameOfParentFolder,
        });
      } else {
        checkForFolderExistence.funcs.push(newFuncToAdd);
      }
    }
  });
  // Sort folders by putting the subfolder next to their parent folder, even though they share the same place in the array
  // except for the nestedLevel prop. A future change to this would be to make folders have subfolders, which is easier
  // understand, but would require a change in the UI.
  // @TODO: Change to have elements have subfolders inside the object?
  finalFunctions.sort((a, b) => {
    if (a.folder === b.parentFolder) {
      return -1;
    }

    return 1;
  });

  return finalFunctions;
};
