script_parent_path="$(dirname "${BASH_SOURCE[0]}")"
benchmark_dir="$(realpath "$script_parent_path/../benchmark-shallow")"
mkdir "$benchmark_dir"
for _ in $(seq 10000); do
    basename="$(cat /dev/urandom | tr -cd 'a-f0-9' | head -c 32)"
    filename="$benchmark_dir/$basename"
    touch "$filename"
    #cp "$script_parent_path/shallow-context.json" "$filename.context.json"
done
