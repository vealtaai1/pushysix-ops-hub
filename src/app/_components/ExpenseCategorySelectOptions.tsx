import * as React from "react";

// Shared <option> list for ExpenseCategory selects.
// Keep labels in sync with FinanceDashboardClient.expenseCategoryLabel.
export function ExpenseCategorySelectOptions() {
  return (
    <>
      <optgroup label="Travel">
        <option value="FLIGHT_EXPENSE">Flight Expense</option>
        <option value="HOTEL_ACCOMMODATION">Hotel/Accommodation</option>
        <option value="GROUND_TRANSPORTATION">Ground Transportation</option>
        <option value="CAR_RENTAL">Rental Car</option>
        <option value="FUEL">Fuel - Rental Car</option>
        <option value="PARKING">Parking</option>
      </optgroup>

      <optgroup label="Food">
        <option value="MEAL">Meal</option>
      </optgroup>

      <optgroup label="Production">
        <option value="CAMERA_GEAR_EQUIPMENT">Camera Gear/Equipment</option>
        <option value="PROP">Filming Prop</option>
      </optgroup>

      <optgroup label="Advertising">
        <option value="AD_SPEND">Advertising Spend</option>
      </optgroup>

      <optgroup label="Other">
        <option value="OTHER">Other</option>
      </optgroup>
    </>
  );
}
