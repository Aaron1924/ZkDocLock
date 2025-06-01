template Main() {
    signal input step_in;
    signal output out;
    out <== step_in * step_in;
}
component main = Main();