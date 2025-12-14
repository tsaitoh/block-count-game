import * as THREE from 'three'
import type { Vec3, ViewDir } from './blockGenerator'

export type RendererOptions = {
  container: HTMLElement
}

export type CameraPreset = {
  id: ViewDir
  position: THREE.Vector3
}

const makeCameraPresets = (): CameraPreset[] => {
  return [
    { id: 'XP', position: new THREE.Vector3(9, 8, 9) },
    { id: 'XN', position: new THREE.Vector3(-9, 8, 9) },
    { id: 'ZP', position: new THREE.Vector3(9, 8, -9) },
  ]
}

export class ThreeBlockRenderer {
  private readonly container: HTMLElement
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly renderer: THREE.WebGLRenderer
  private readonly root: THREE.Group

  private readonly lightKey: THREE.DirectionalLight
  private readonly lightFill: THREE.DirectionalLight
  private readonly amb: THREE.AmbientLight

  private readonly cubeGeo: THREE.BoxGeometry
  private readonly cubeMat: THREE.MeshStandardMaterial
  private readonly edgeMat: THREE.LineBasicMaterial

  private animationHandle: number | null = null
  private presets: CameraPreset[]
  private target = new THREE.Vector3(0, 0, 0)

  constructor(opts: RendererOptions) {
    this.container = opts.container

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#f7f7f7')

    const w = Math.max(1, this.container.clientWidth)
    const h = Math.max(1, this.container.clientHeight)

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(w, h)
    this.container.appendChild(this.renderer.domElement)

    this.root = new THREE.Group()
    this.scene.add(this.root)

    this.amb = new THREE.AmbientLight(0xffffff, 0.65)
    this.scene.add(this.amb)

    this.lightKey = new THREE.DirectionalLight(0xffffff, 0.75)
    this.lightKey.position.set(8, 10, 6)
    this.scene.add(this.lightKey)

    this.lightFill = new THREE.DirectionalLight(0xffffff, 0.35)
    this.lightFill.position.set(-6, 6, -8)
    this.scene.add(this.lightFill)

    this.cubeGeo = new THREE.BoxGeometry(1, 1, 1)
    this.cubeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0.0 })
    this.edgeMat = new THREE.LineBasicMaterial({ color: 0x111111, linewidth: 1 })

    this.presets = makeCameraPresets()
    this.setView('XP')

    this.handleResize = this.handleResize.bind(this)
    window.addEventListener('resize', this.handleResize)

    this.animate = this.animate.bind(this)
    this.animate()
  }

  destroy(): void {
    window.removeEventListener('resize', this.handleResize)
    if (this.animationHandle != null) cancelAnimationFrame(this.animationHandle)
    this.renderer.dispose()
    this.container.removeChild(this.renderer.domElement)
  }

  private handleResize(): void {
    const w = Math.max(1, this.container.clientWidth)
    const h = Math.max(1, this.container.clientHeight)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  private animate(): void {
    this.animationHandle = requestAnimationFrame(this.animate)
    this.renderer.render(this.scene, this.camera)
  }

  setView(id: ViewDir): void {
    const p = this.presets.find((x) => x.id === id) ?? this.presets[0]
    this.camera.position.copy(p.position)
    this.camera.lookAt(this.target)
  }

  setBlocks(blocks: Vec3[]): void {
    while (this.root.children.length > 0) {
      const child = this.root.children.pop()
      if (!child) break
      child.traverse((obj: THREE.Object3D) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
        }
      })
    }

    if (blocks.length === 0) {
      this.target.set(0, 0, 0)
      this.camera.lookAt(this.target)
      return
    }

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity

    for (const b of blocks) {
      minX = Math.min(minX, b.x)
      minY = Math.min(minY, b.y)
      minZ = Math.min(minZ, b.z)
      maxX = Math.max(maxX, b.x)
      maxY = Math.max(maxY, b.y)
      maxZ = Math.max(maxZ, b.z)
    }

    const center = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2)
    this.target.copy(center)

    for (const b of blocks) {
      const mesh = new THREE.Mesh(this.cubeGeo, this.cubeMat)
      mesh.position.set(b.x, b.y, b.z)
      this.root.add(mesh)

      const edges = new THREE.EdgesGeometry(this.cubeGeo)
      const line = new THREE.LineSegments(edges, this.edgeMat)
      line.position.copy(mesh.position)
      this.root.add(line)
    }

    const size = new THREE.Vector3(maxX - minX + 1, maxY - minY + 1, maxZ - minZ + 1)
    const d = Math.max(size.x, size.y, size.z)

    this.presets = [
      { id: 'XP', position: new THREE.Vector3(center.x + d * 2.2, center.y + d * 1.9, center.z + d * 2.0) },
      { id: 'XN', position: new THREE.Vector3(center.x - d * 2.2, center.y + d * 1.9, center.z + d * 2.0) },
      { id: 'ZP', position: new THREE.Vector3(center.x + d * 2.0, center.y + d * 1.9, center.z - d * 2.2) },
    ]

    this.camera.position.copy(this.presets[0].position)
    this.camera.lookAt(this.target)
  }
}
