import * as React from "react";

// Shared <option> list for ExpenseCategory selects.
// Keep labels in sync with FinanceDashboardClient.expenseCategoryLabel.
export function ExpenseCategorySelectOptions() {
  return (
    <>
      <option value="HOTEL_ACCOMMODATION">Hotel/Accommodation</option>
      <option value="MEAL">Meal</option>
      <option value="PROP">Filming Prop</option>
      <option value="CAMERA_GEAR_EQUIPMENT">Camera Gear/Equipment</option>
      <option value="PARKING">Parking</option>
      <option value="CAR_RENTAL">Rental Car</option>
      <option value="FUEL">Fuel - Rental Car</option>
      <option value="FLIGHT_EXPENSE">Flight Expense</option>
      <option value="GROUND_TRANSPORTATION">Ground Transportation</option>
      <option value="AD_SPEND">Advertising Spend</option>
      <option value="OTHER">Other</option>
    </>
  );
}
