# TODO - Seat Layout Enhancements

## Done
- [ ] (Plan approved) interpret layout and color rules.

## Next
1. Fix `src/components/SeatLayout.jsx`
   - [ ] Remove duplicated `getSeatInfo` function.
   - [ ] Implement correct fixed row ordering:
     - [ ] top: 24-34
     - [ ] middle: 13-23
     - [ ] bottom: 1-12
   - [ ] Add session filter controls: All / Only Morning / Only Evening.
   - [ ] Implement orange (morning) / black (evening) seat rendering.
   - [ ] Seat click logic:
     - [ ] half: show single occupant
     - [ ] full/shared: show two occupants
     - [ ] vacant: prompt registration flow
2. Enhance seat popup modal in `src/components/SeatLayout.jsx`
   - [ ] Show monthly-wise payment records (month, payment entries, and month total).
3. Update CSS in `src/index.css`
   - [ ] Add classes for morning/evening occupied colors.
4. Run and verify
   - [ ] `npm run dev`
   - [ ] open Seat Layout and validate row order + colors + click popup behavior.

