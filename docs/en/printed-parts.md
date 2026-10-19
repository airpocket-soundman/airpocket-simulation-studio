# 3D printed parts mode — final optional phase

[日本語](../printed-parts.md)

Related plan: [Buildable measurement machines and Bambu test specimens for CAE calibration](printed-material-measurement.md). Provide a user-operated measurement workflow; this is separate from publishing constants measured by the development team.

Start after the standard analysis capabilities work. Distinguish Bambu Studio project 3MF, sliced .gcode.3mf and G-code; inspect actual contents and versions. Report missing geometry or settings and request supplemental data when necessary.

Import build orientation, layer height, walls, infill density/pattern, material and extrusion paths where available. Start with calibrated orthotropic equivalent materials; consider explicit walls, infill and interlayer models later. Explain which model is used.

Slice data alone cannot determine layer bonding, voids, manufacturing defects or fracture strength. Register test data for the filament and manufacturing conditions, and validate with direction-dependent coupons and real parts. Sending jobs to printers or operating them is outside this feature.

Official references: [Bambu Studio](https://github.com/bambulab/BambuStudio), [CLI 3MF export](https://github.com/bambulab/BambuStudio/wiki/Command-Line-Usage). Currently planned.
