# Trainer board visual reference research

## Reference interpretation

The supplied photographs show a flat, cream/white electronics experiment trainer with an aluminum perimeter frame, red/black banana-style sockets, and blue silk-screened circuit symbols. The visible layout is broadly divided into:
- capacitor and inductor components on the left,
- diode / transistor / op-amp symbols and test points through the middle,
- a multi-row resistor bank toward the upper-right,
- a small power/connection area near the lower-right.

The analog meter visible in the first photographs is a separate mounted instrument and is intentionally omitted from the virtual board face per the project request.

The photographs do not show a legible manufacturer name or model number. The printed text appears to include “ELECTRONICS EXPERIMENT BOARD” and “COMPUTER ENGINEERING TECHNIQUES”, but this is not enough to identify a unique commercial product. The safest classification is a generic analog/discrete-component electronics trainer board.

## Research references

- Kitek Technologies, Analog Board Trainer Kit DTK-02E: documents a trainer with resistor bank, capacitor bank, inductor bank, diode, transistors, JFET/MOSFET and banana-socket style experiment connections.
  https://kitektechnologies.com/digital-analog-bread-board-trainer.html
- Mine Instruments, Analog Circuit Trainer MI-A01B: describes component banks, printed symbols on a glass-epoxy panel, and 2mm banana sockets/test points.
  https://mineinstruments.com/product/analog-circuit-trainer-mi-a01b/
- Mine Instruments, Discrete Component Trainer MI-BA01: describes on-board resistance, capacitance and inductance banks, semiconductor component bank, and symbols printed on a glass-epoxy PCB.
  https://mineinstruments.com/product/discrete-component-trainer-mi-ba01/
- Tescaglobal, Transistor Application Trainer: describes resistor/capacitor/inductor/diode/potentiometer banks and transistor devices on one trainer.
  https://www.tescaglobal.com/product/transistor-application-trainer

These are comparable product references, not proof that any one is the exact board in the photographs.

## Image limitations

The resistor value labels in the supplied photos are blurred and partially occluded. The existing project resistor values and port IDs are therefore preserved rather than guessing new values from unreadable text. A sharply focused, straight-on close-up of the resistor bank would be needed to transcribe every printed value and its exact row order with confidence.

## UI implementation notes

- Remove the galvanometer from the board face.
- Use printed blue zig-zag resistor symbols between red sockets rather than beige physical resistor bodies.
- Arrange the resistor bank in two columns, similar to the photographed board.
- Preserve existing port IDs and circuit simulation wiring so existing experiments do not break.
