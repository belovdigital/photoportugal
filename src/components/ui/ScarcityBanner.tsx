export function ScarcityBanner({
  count,
  locationName,
  locale,
  context = "location",
}: {
  count: number;
  locationName: string;
  locale: string;
  context?: "location" | "shootType";
}) {
  const isPt = locale === "pt";

  let headline: string;
  let body: string;

  if (context === "shootType") {
    if (isPt) {
      headline = count <= 3
        ? `Apenas ${count} ${count === 1 ? "fotógrafo especializado" : "fotógrafos especializados"} em ${locationName.toLowerCase()} agora`
        : `Alta procura de fotógrafos de ${locationName.toLowerCase()}`;
      body = "Estes fotógrafos costumam estar totalmente reservados — sobretudo aos fins-de-semana e em época alta. Reserve agora para garantir a sua data.";
    } else {
      headline = count <= 3
        ? `Only ${count} ${locationName.toLowerCase()} photographer${count === 1 ? "" : "s"} available right now`
        : `High demand for ${locationName.toLowerCase()} photoshoots`;
      body = "These photographers are usually fully booked — especially on weekends and during peak season. Book now to secure your preferred date.";
    }
  } else {
    if (isPt) {
      headline = count <= 3
        ? `Apenas ${count} ${count === 1 ? "fotógrafo disponível" : "fotógrafos disponíveis"} em ${locationName} agora`
        : `Alta procura em ${locationName}`;
      body = "Estes fotógrafos costumam estar totalmente reservados — sobretudo aos fins-de-semana e em época alta. Reserve agora para garantir a sua data.";
    } else {
      headline = count <= 3
        ? `Only ${count} photographer${count === 1 ? "" : "s"} available in ${locationName} right now`
        : `High demand in ${locationName}`;
      body = "These photographers are usually fully booked — especially on weekends and during peak season. Book now to secure your preferred date.";
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg" aria-hidden>
        ⚡
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-900">{headline}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-amber-800">{body}</p>
      </div>
    </div>
  );
}
