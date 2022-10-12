import { defineComponent, ref } from "vue";

export default defineComponent({

    name: "FileUpload",

    setup() {
        const file = ref<File | null>();
        const form = ref<HTMLFormElement>();

        function onFileChanged($event: Event) {
            const target = $event.target as HTMLInputElement;
            if (target && target.files) {
                file.value = target.files[0];
            }
        }

        async function saveImage() {
            if (file.value) {
                try {
                    // save file.value
                } catch (error) {
                    console.error(error);
                    form.value?.reset();
                    file.value = null;
                } finally {
                }
            }
        };

        return {
            saveImage,
            onFileChanged,
        }
    }
});