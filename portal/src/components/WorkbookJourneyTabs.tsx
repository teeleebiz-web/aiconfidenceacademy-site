export function WorkbookJourneyTabs({ journey, availableJourneys, onSelect }: {
  journey: number
  availableJourneys: number[]
  onSelect: (journey: number) => void
}) {
  return <nav className="wb-journey-tabs" aria-label="Choose a workbook">
    {Array.from({ length: 6 }, (_, i) => i + 1).map(number => (
      <button type="button" key={number} aria-pressed={journey === number}
        disabled={!availableJourneys.includes(number)} onClick={() => onSelect(number)}>
        Workbook {number} — Journey {number}
      </button>
    ))}
  </nav>
}
