export function PlateView({ items }: { items: any[] }) {
  return (
    <div className="plate">
      {items.map(item => (
        <div key={item.query} className={`plate-part ${item.role}`}>
          <strong>{item.selectedFood?.namn ?? item.query}</strong>
          <span>{item.grams} g</span>
          <span>{item.carbs} g kolhydrater</span>
        </div>
      ))}
    </div>
  );
}
