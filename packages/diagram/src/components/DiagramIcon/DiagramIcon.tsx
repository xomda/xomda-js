import { defineComponent } from 'vue'

export const DiagramIcon = defineComponent({
  props: {
    icon: { type: String, required: true },
    size: { type: [String, Number], default: 20 },
  },
  setup(props) {
    return () => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={props.size}
        height={props.size}
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d={props.icon} />
      </svg>
    )
  },
})
