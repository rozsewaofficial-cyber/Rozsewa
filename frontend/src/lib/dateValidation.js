export const validateDate = (dateString, options = {}) => {
  if (!dateString) return { isValid: false, message: 'Date is required' };

  const selectedDate = new Date(dateString);
  if (isNaN(selectedDate.getTime())) {
    return { isValid: false, message: 'Invalid date format' };
  }

  // Reset times to start of day for accurate date comparison
  const selectedDateOnly = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  
  if (options.minDate) {
    const minDate = new Date(options.minDate);
    const minDateOnly = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
    if (selectedDateOnly < minDateOnly) {
      return { isValid: false, message: options.minErrorMessage || 'Date cannot be in the past' };
    }
  }

  if (options.maxDate) {
    const maxDate = new Date(options.maxDate);
    const maxDateOnly = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
    if (selectedDateOnly > maxDateOnly) {
      return { isValid: false, message: options.maxErrorMessage || 'Date cannot be in the future' };
    }
  }

  return { isValid: true, message: null };
};
