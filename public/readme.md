# Web Calculator with Day/Night Themes

A modern, responsive web calculator with beautiful day and night theme options. Built with HTML, CSS, and JavaScript.

## Features

### 🔧 Calculator Functions
- Basic arithmetic operations (addition, subtraction, multiplication, division)
- Clear (C) and Clear Entry (CE) functions
- Decimal point support with validation
- Error handling for invalid operations and division by zero
- Chain calculations support

### 🎨 Themes
- **Light Theme (Day)**: Clean, bright interface with light colors
- **Dark Theme (Night)**: Modern dark interface with high contrast
- Smooth theme transitions with CSS animations
- Theme toggle button with emoji indicators

### ⌨️ Input Methods
- **Mouse/Touch**: Click buttons to input numbers and operations
- **Keyboard Support**:
  - Numbers (0-9) and decimal point (.)
  - Operators (+, -, *, /)
  - Enter or = key to calculate
  - Escape or C key to clear display
  - Backspace to delete last entry

### 📱 Responsive Design
- Mobile-friendly interface
- Adaptive button sizes for different screen sizes
- Optimized for both desktop and mobile devices

## Design Features

### Visual Elements
- **Modern UI**: Gradient backgrounds, rounded corners, and smooth shadows
- **Interactive Buttons**: Hover effects with elevation animation
- **Professional Typography**: Clean, readable font styling
- **Color-Coded Buttons**:
  - Number buttons: Neutral colors that adapt to theme
  - Operators: Orange gradient for easy identification
  - Clear buttons: Red gradient for destructive actions
  - Equals button: Green gradient for confirmation

### Animations & Transitions
- Smooth theme switching transitions
- Button hover and active state animations
- Responsive button press feedback
- Theme toggle button scaling effect

## File Structure
```
calculator.html    # Complete calculator application
README.md         # This documentation file
```

## Usage

1. **Open the Calculator**: Open `calculator.html` in any modern web browser
2. **Switch Themes**: Click the theme toggle button (🌙 Dark Mode / ☀️ Light Mode)
3. **Perform Calculations**:
   - Click number buttons or use keyboard
   - Select operators (+, -, ×, /)
   - Press = or Enter to calculate
   - Use C to clear all or CE to clear last entry

## Browser Compatibility

This calculator works in all modern web browsers:
- Chrome 50+
- Firefox 40+
- Safari 10+
- Edge 12+
- Mobile browsers (iOS Safari, Chrome Mobile, etc.)

## Technical Implementation

### HTML Structure
- Semantic HTML5 structure
- Accessibility-friendly input elements
- Grid-based button layout

### CSS Features
- CSS Grid for button layout
- CSS Custom Properties for theme variables
- Advanced CSS gradients and shadows
- Responsive media queries
- Smooth CSS transitions

### JavaScript Functionality
- Event-driven calculator logic
- Input validation and error handling
- Theme persistence during session
- Keyboard event listeners
- Mobile-responsive touch handling

## Customization

You can easily customize the calculator by modifying the CSS variables:

### Colors
- Update gradient colors in the CSS for different visual themes
- Modify shadow intensities for different depth effects
- Adjust border-radius values for different corner styles

### Layout
- Change button sizes by modifying width/height in `.btn`
- Adjust spacing by changing the `gap` property in `.buttons`
- Modify display size by updating `.display` height and font-size

### Functionality
- Add more advanced operations by extending the JavaScript functions
- Implement memory functions (M+, M-, MR, MC)
- Add scientific calculator features

## License

This project is open source and available under the MIT License.

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve this calculator.