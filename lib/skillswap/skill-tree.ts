const skillPaths: Array<{ domain: string; keys: string[] }> = [
  {
    domain: "Programare",
    keys: ["html & css", "javascript", "react", "next.js"],
  },
  {
    domain: "Design digital",
    keys: ["design basics", "figma", "ui design", "design systems"],
  },
  {
    domain: "Limbi străine",
    keys: ["engleză a1", "engleză a2", "engleză b1", "engleză b2"],
  },
  {
    domain: "Date",
    keys: ["excel", "sql", "python pentru date", "data vizualization"],
  },
] as const;

export function getSuggestedSkillPath(offeredSkill: string, wantedSkill: string) {
  const offered = offeredSkill.trim().toLocaleLowerCase("en-US");
  const wanted = wantedSkill.trim().toLocaleLowerCase("en-US");
  const matchingPath = skillPaths.find((path) =>
    path.keys.includes(offered) || path.keys.includes(wanted),
  );

  if (!matchingPath) {
    return {
      domain: "Parcurs personalizat",
      nodes: [
        offeredSkill || "Abilitate actuală",
        "Bazele domeniului",
        wantedSkill || "Următorul pas",
      ],
    };
  }

  const keys = [...matchingPath.keys];
  const startIndex = keys.includes(offered) ? keys.indexOf(offered) : 0;
  const goalIndex = keys.includes(wanted) ? keys.indexOf(wanted) : keys.length - 1;
  const nodes = startIndex <= goalIndex
    ? keys.slice(startIndex, goalIndex + 1)
    : keys.slice(goalIndex, startIndex + 1).reverse();
  if (!keys.includes(offered)) nodes.unshift(offeredSkill || "Abilitate actuală");
  if (!keys.includes(wanted)) nodes.push(wantedSkill || "Următorul pas");

  return {
    domain: matchingPath.domain,
    nodes: nodes.map((node) => {
      if (node === offered) return offeredSkill;
      if (node === wanted) return wantedSkill;
      return node.replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("en-US"));
    }),
  };
}
